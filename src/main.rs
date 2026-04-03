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

            // Create the main menu and add the submenu
            let menu = Menu::with_items(app, &[&ajuda_submenu])?;

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
                }
            });
            //only debug this code in debug mode
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