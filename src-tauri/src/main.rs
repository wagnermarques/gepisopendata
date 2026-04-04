// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri::{
        menu::{
           Menu, MenuItem, Submenu
        },
        Emitter, Manager,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use std::fs::File;
use std::io::{copy, Write};
use std::path::PathBuf;

// Rust command to download a file and update the registry
#[tauri::command]
async fn download_dataset(app_handle: tauri::AppHandle, url: String, metadata: serde_json::Value) -> Result<String, String> {
    println!("Rust => Downloading from URL: {}", url);
    
    // 1. Get the filename from the URL
    let file_name = url.split('/').last().unwrap_or("dataset.zip");
    
    // 2. Resolve AppData path for the large binary files (not committed)
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let downloads_dir = app_data_dir.join("downloads");
    std::fs::create_dir_all(&downloads_dir).map_err(|e| e.to_string())?;
    
    let dest_path = downloads_dir.join(file_name);

    // 3. Perform the download
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .danger_accept_invalid_certs(true) 
        .build()
        .map_err(|e| format!("Erro ao criar cliente HTTP: {}", e))?;

    let response = client.get(&url).send().await.map_err(|e| format!("Erro na requisição: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Servidor retornou erro {}: {}", response.status(), url));
    }

    let content = response.bytes().await.map_err(|e| format!("Erro ao ler bytes: {}", e))?;
    let mut file = File::create(&dest_path).map_err(|e| format!("Erro ao criar arquivo local: {}", e))?;
    copy(&mut content.as_ref(), &mut file).map_err(|e| format!("Erro ao salvar arquivo: {}", e))?;

    // 4. Resolve the Registry Path (The portable/committable part)
    // In DEVELOPMENT, we also write to the source tree assets folder
    let mut registry_paths = vec![app_data_dir.join("datasets-registry.json")];
    
    #[cfg(debug_assertions)]
    {
        // Try to find the project root during development to sync the JSON
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let project_assets = PathBuf::from(manifest_dir)
                .join("..")
                .join("angular-ui")
                .join("src")
                .join("assets")
                .join("data")
                .join("datasets-registry.json");
            
            println!("Rust Dev => Syncing registry to source: {:?}", project_assets);
            registry_paths.push(project_assets);
        }
    }

    // 5. Update Registry in all resolved paths
    for path in registry_paths {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let mut registry: Vec<serde_json::Value> = if path.exists() {
            let file = File::open(&path).map_err(|e| e.to_string())?;
            serde_json::from_reader(file).unwrap_or_else(|_| vec![])
        } else {
            vec![]
        };

        let mut entry = metadata.clone();
        if let Some(obj) = entry.as_object_mut() {
            obj.insert("id".to_string(), serde_json::json!(uuid::Uuid::new_v4().to_string()));
            obj.insert("dateAdded".to_string(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
            obj.insert("file".to_string(), serde_json::json!(file_name));
        }
        registry.push(entry);

        let mut file = File::create(&path).map_err(|e| e.to_string())?;
        let json = serde_json::to_string_pretty(&registry).map_err(|e| e.to_string())?;
        file.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    }

    Ok(file_name.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_mcp_gui::init())
        .invoke_handler(tauri::generate_handler![download_dataset])
        .setup(|app| {
            // Create the "Sobre" menu item
            let sobre_item = MenuItem::with_id(app, "sobre", "Sobre", true, None::<&str>)?;

            // Create the "Ajuda" submenu
            let ajuda_submenu = Submenu::with_items(
                app,
                "Ajuda",
                true,
                &[&sobre_item],
            )?;

            // Create items for "Conjuntos de Dados"
            let obter_item = MenuItem::with_id(app, "obter_dados", "Obter Conj. Dados", true, None::<&str>)?;
            let listar_item = MenuItem::with_id(app, "listar_dados", "Listar Conjunto De Dados", true, None::<&str>)?;
            let gerenciar_item = MenuItem::with_id(app, "gerenciar_dados", "Gerenciar Conjunto de dados", true, None::<&str>)?;

            // Create the "Conjuntos de Dados" submenu
            let conjuntos_submenu = Submenu::with_items(
                app,
                "Conjuntos de Dados",
                true,
                &[&obter_item, &listar_item, &gerenciar_item],
            )?;

            // Create items for "Analisar Dados"
            let selecionar_item = MenuItem::with_id(app, "selecionar_dados", "Selecionar Conjunto de Dados", true, None::<&str>)?;
            let configurar_item = MenuItem::with_id(app, "configurar_variaveis", "Configurar Variaveis", true, None::<&str>)?;
            let analises_item = MenuItem::with_id(app, "analises_descritivas", "Analises Descritivas", true, None::<&str>)?;

            // Create the "Analisar Dados" submenu
            let analisar_submenu = Submenu::with_items(
                app,
                "Analisar Dados",
                true,
                &[&selecionar_item, &configurar_item, &analises_item],
            )?;

            // Create the main menu and add the submenus
            let menu = Menu::with_items(app, &[&conjuntos_submenu, &analisar_submenu, &ajuda_submenu])?;

            // Set the menu for the application
            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(move |app, event| {
                println!("main.rs => Menu event triggered: {:?}", event.id);
                if event.id == "sobre" {
                    app.dialog()
                        .message("Gepis Dados Abertos\nVersão 0.1.0\n\nEste projeto é uma iniciativa do grupo de pesquisa Gepis para promover a utilização de dados abertos.")
                        .title("Sobre o Gepis Dados Abertos")
                        .kind(MessageDialogKind::Info)
                        .show(|_result| {});
                } else {
                    // Emit navigation event for all other menu items
                    println!("Emitting menu-navigation event for: {}", event.id.0.as_str());
                    if let Err(e) = app.emit("menu-navigation", event.id.0.as_str()) {
                        eprintln!("Failed to emit menu-navigation event: {}", e);
                    }
                }
            });            //only debug this code in debug mode
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
                window.close_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
