// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri::{
        menu::{
           Menu, MenuItem, Submenu
        },
        Emitter, Manager,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use std::fs::{File, self};
use std::io::{copy, Write};
use std::path::PathBuf;
use zip::ZipArchive;

// Helper to sanitize filenames
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>()
        .to_lowercase()
}

// Rust command to download a file and update the registry with organized folders
#[tauri::command]
async fn download_dataset(app_handle: tauri::AppHandle, url: String, metadata: serde_json::Value) -> Result<String, String> {
    println!("Rust => Processing download for: {}", url);
    
    // 1. Extract info from metadata
    let titulo_curto = metadata["tituloCurto"].as_str().unwrap_or("sem-titulo");
    let grupo = metadata["grupo"].as_str().unwrap_or("sem-grupo");
    let formato_esperado = metadata["formato"].as_str().unwrap_or("outro").to_lowercase();
    
    let grupo_folder = if grupo.trim().is_empty() { "sem-grupo".to_string() } else { sanitize_filename(grupo) };
    let dataset_folder = sanitize_filename(titulo_curto);

    // 2. Resolve Base Downloads Directory
    let mut base_downloads_path = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    #[cfg(debug_assertions)]
    {
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            base_downloads_path = PathBuf::from(manifest_dir).join("downloads");
        }
    }

    let target_dir = base_downloads_path.join("datasets").join(&grupo_folder).join(&dataset_folder);
    fs::create_dir_all(&target_dir).map_err(|e| format!("Erro ao criar pastas: {}", e))?;

    // 3. Download the file
    let file_name = url.split('/').last().unwrap_or("dataset.zip");
    let dest_path = target_dir.join(file_name);

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

    let mut final_files = vec![file_name.to_string()];

    // 4. Auto-Extraction Logic
    if (file_name.ends_with(".zip") || file_name.ends_with(".ZIP")) && formato_esperado != "zip" {
        println!("Rust => ZIP detected and format is {}, extracting...", formato_esperado);
        
        let zip_file = File::open(&dest_path).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(zip_file).map_err(|e| e.to_string())?;
        
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let outpath = match file.enclosed_name() {
                Some(path) => path.to_owned(),
                None => continue,
            };

            if (*file.name()).ends_with('/') {
                fs::create_dir_all(&target_dir.join(&outpath)).map_err(|e| e.to_string())?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(&target_dir.join(p)).map_err(|e| e.to_string())?;
                    }
                }
                
                // If it's the expected format, rename it to the short title
                let extension = outpath.extension().and_then(|s| s.to_str()).unwrap_or("");
                let mut final_name = outpath.file_name().unwrap().to_string_lossy().into_owned();
                
                if extension.to_lowercase() == formato_esperado {
                    final_name = format!("{}.{}", sanitize_filename(titulo_curto), extension);
                }

                let extract_dest = target_dir.join(&final_name);
                let mut outfile = fs::File::create(&extract_dest).map_err(|e| e.to_string())?;
                copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
                
                if !final_files.contains(&final_name) {
                    final_files.push(final_name);
                }
            }
        }
        // Optional: remove the zip after extraction to save space
        // let _ = fs::remove_file(&dest_path);
    }

    // 5. Update Registry
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut registry_paths = vec![app_data_dir.join("datasets-registry.json")];
    
    #[cfg(debug_assertions)]
    {
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            registry_paths.push(PathBuf::from(manifest_dir).join("angular-ui").join("data").join("datasets-registry.json"));
        }
    }

    for path in registry_paths {
        if let Some(parent) = path.parent() { let _ = fs::create_dir_all(parent); }

        let mut registry: Vec<serde_json::Value> = if path.exists() {
            let file = File::open(&path).map_err(|e| e.to_string())?;
            serde_json::from_reader(file).unwrap_or_else(|_| vec![])
        } else { vec![] };

        let entry_id = format!("{}-{}", sanitize_filename(grupo), sanitize_filename(titulo_curto));
        let mut entry_exists = false;
        
        for item in registry.iter_mut() {
            if item["id"].as_str() == Some(&entry_id) {
                if let Some(files) = item["files"].as_array_mut() {
                    for f in &final_files {
                        if !files.contains(&serde_json::json!(f)) { files.push(serde_json::json!(f)); }
                    }
                }
                entry_exists = true;
                break;
            }
        }

        if !entry_exists {
            let mut entry = metadata.clone();
            if let Some(obj) = entry.as_object_mut() {
                obj.insert("id".to_string(), serde_json::json!(entry_id));
                obj.insert("dateAdded".to_string(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
                obj.insert("files".to_string(), serde_json::json!(final_files));
                obj.insert("localPath".to_string(), serde_json::json!(target_dir.to_string_lossy()));
            }
            registry.push(entry);
        }

        let mut file = File::create(&path).map_err(|e| e.to_string())?;
        let json = serde_json::to_string_pretty(&registry).map_err(|e| e.to_string())?;
        file.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    }

    Ok(file_name.to_string())
}

#[tauri::command]
async fn get_registry(app_handle: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut registry_path = app_data_dir.join("datasets-registry.json");

    #[cfg(debug_assertions)]
    {
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let dev_path = PathBuf::from(manifest_dir).join("angular-ui").join("data").join("datasets-registry.json");
            if dev_path.exists() { registry_path = dev_path; }
        }
    }

    if registry_path.exists() {
        let file = File::open(&registry_path).map_err(|e| e.to_string())?;
        let registry: Vec<serde_json::Value> = serde_json::from_reader(file).map_err(|e| e.to_string())?;
        Ok(registry)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn check_path_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_mcp_gui::init())
        .invoke_handler(tauri::generate_handler![download_dataset, get_registry, check_path_exists])
        .setup(|app| {
            let sobre_item = MenuItem::with_id(app, "sobre", "Sobre", true, None::<&str>)?;
            let ajuda_submenu = Submenu::with_items(app, "Ajuda", true, &[&sobre_item])?;
            let obter_item = MenuItem::with_id(app, "obter_dados", "Obter Conj. Dados", true, None::<&str>)?;
            let listar_item = MenuItem::with_id(app, "listar_dados", "Listar Conjunto De Dados", true, None::<&str>)?;
            let gerenciar_item = MenuItem::with_id(app, "gerenciar_dados", "Gerenciar Conjunto de dados", true, None::<&str>)?;
            let conjuntos_submenu = Submenu::with_items(app, "Conjuntos de Dados", true, &[&obter_item, &listar_item, &gerenciar_item])?;
            let selecionar_item = MenuItem::with_id(app, "selecionar_dados", "Selecionar Conjunto de Dados", true, None::<&str>)?;
            let configurar_item = MenuItem::with_id(app, "configurar_variaveis", "Configurar Variaveis", true, None::<&str>)?;
            let analises_item = MenuItem::with_id(app, "analises_descritivas", "Analises Descritivas", true, None::<&str>)?;
            let analisar_submenu = Submenu::with_items(app, "Analisar Dados", true, &[&selecionar_item, &configurar_item, &analises_item])?;
            let menu = Menu::with_items(app, &[&conjuntos_submenu, &analisar_submenu, &ajuda_submenu])?;
            app.set_menu(menu)?;
            app.on_menu_event(move |app, event| {
                if event.id == "sobre" {
                    app.dialog().message("Gepis Dados Abertos\nVersão 0.1.0\n\nEste projeto é uma iniciativa do grupo de pesquisa Gepis para promover a utilização de dados abertos.").title("Sobre o Gepis Dados Abertos").kind(MessageDialogKind::Info).show(|_| {});
                } else {
                    let _ = app.emit("menu-navigation", event.id.0.as_str());
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
