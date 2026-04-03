// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri::{
    menu::{Menu, MenuItem, Submenu},
    Manager,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
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
                if event.id == "sobre" {
                    app.dialog()
                        .message("Gepis Dados Abertos\nVersão 0.1.0\n\nEste projeto é uma iniciativa do grupo de pesquisa Gepis para promover a utilização de dados abertos.")
                        .title("Sobre o Gepis Dados Abertos")
                        .kind(MessageDialogKind::Info)
                        .show(|_result| {});
                } else if event.id == "obter_dados" {
                    // Placeholder for "Obter Conj. Dados"
                } else if event.id == "listar_dados" {
                    // Placeholder for "Listar Conjunto De Dados"
                } else if event.id == "gerenciar_dados" {
                    // Placeholder for "Gerenciar Conjunto de dados"
                } else if event.id == "selecionar_dados" {
                    // Placeholder for "Selecionar Conjunto de Dados"
                } else if event.id == "configurar_variaveis" {
                    // Placeholder for "Configurar Variaveis"
                } else if event.id == "analises_descritivas" {
                    // Placeholder for "Analises Descritivas"
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