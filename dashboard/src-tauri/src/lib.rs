use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

static LEGACY_IMPORT_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyMarkdownNote {
    file_name: String,
    contents: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MarkdownFile {
    file_name: String,
    contents: String,
    created_at: Option<u64>,
    modified_at: Option<u64>,
}

fn notes_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join("notes");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory)
}

fn note_path(directory: &Path, file_name: &str) -> Result<PathBuf, String> {
    let path = Path::new(file_name);
    let is_safe_name = path.components().count() == 1
        && path.file_name().and_then(|name| name.to_str()) == Some(file_name)
        && path.extension().and_then(|extension| extension.to_str()) == Some("md")
        && !file_name.starts_with('.')
        && !file_name.contains('/')
        && !file_name.contains('\\');

    if !is_safe_name {
        return Err("Invalid Markdown note filename".to_string());
    }

    Ok(directory.join(path))
}

fn atomic_write(path: &Path, contents: &str) -> Result<(), String> {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Invalid note filename".to_string())?;
    let temporary_path = path.with_file_name(format!(".{file_name}.{nonce}.tmp"));
    let backup_path = path.with_file_name(format!(".{file_name}.{nonce}.bak"));

    fs::write(&temporary_path, contents).map_err(|error| error.to_string())?;
    if !path.exists() {
        return fs::rename(&temporary_path, path).map_err(|error| error.to_string());
    }

    fs::rename(path, &backup_path).map_err(|error| error.to_string())?;
    if let Err(error) = fs::rename(&temporary_path, path) {
        let _ = fs::rename(&backup_path, path);
        let _ = fs::remove_file(&temporary_path);
        return Err(error.to_string());
    }
    fs::remove_file(backup_path).map_err(|error| error.to_string())
}

fn save_note_file(
    directory: &Path,
    old_file_name: Option<&str>,
    file_name: &str,
    contents: &str,
) -> Result<(), String> {
    let destination = note_path(directory, file_name)?;

    if let Some(old_file_name) = old_file_name {
        let source = note_path(directory, old_file_name)?;
        if source == destination {
            return atomic_write(&destination, contents);
        }
        if destination.exists() {
            return Err("A note with that filename already exists".to_string());
        }
        fs::rename(&source, &destination).map_err(|error| error.to_string())?;
        if let Err(error) = atomic_write(&destination, contents) {
            let _ = fs::rename(&destination, &source);
            return Err(error);
        }
        return Ok(());
    }

    if destination.exists() {
        return Err("A note with that filename already exists".to_string());
    }
    atomic_write(&destination, contents)
}

fn delete_note_file(directory: &Path, file_name: &str) -> Result<(), String> {
    let path = note_path(directory, file_name)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn import_legacy_notes(directory: &Path, notes: Vec<LegacyMarkdownNote>) -> Result<bool, String> {
    let _lock = LEGACY_IMPORT_LOCK
        .lock()
        .map_err(|error| error.to_string())?;
    let marker = directory.join(".legacy-notes-migrated-v1");
    if marker.exists() {
        return Ok(false);
    }

    for note in notes {
        let path = note_path(directory, &note.file_name)?;
        if !path.exists() {
            atomic_write(&path, &note.contents)?;
        }
    }

    atomic_write(&marker, "complete")?;
    Ok(true)
}

#[tauri::command]
fn list_markdown_notes(app: AppHandle) -> Result<Vec<MarkdownFile>, String> {
    let directory = notes_directory(&app)?;
    let mut notes = Vec::new();

    for entry in fs::read_dir(&directory).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_file()
        {
            continue;
        }
        let file_name = entry.file_name().to_string_lossy().into_owned();
        if !file_name.ends_with(".md") || note_path(&directory, &file_name).is_err() {
            continue;
        }
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        let timestamp = |time: Result<SystemTime, std::io::Error>| {
            time.ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis() as u64)
        };
        notes.push(MarkdownFile {
            file_name,
            contents: fs::read_to_string(entry.path()).map_err(|error| error.to_string())?,
            created_at: timestamp(metadata.created()),
            modified_at: timestamp(metadata.modified()),
        });
    }

    notes.sort_by(|left, right| left.file_name.cmp(&right.file_name));
    Ok(notes)
}

#[tauri::command]
fn save_markdown_note(
    app: AppHandle,
    old_file_name: Option<String>,
    file_name: String,
    contents: String,
) -> Result<(), String> {
    let directory = notes_directory(&app)?;
    save_note_file(&directory, old_file_name.as_deref(), &file_name, &contents)
}

#[tauri::command]
fn delete_markdown_note(app: AppHandle, file_name: String) -> Result<(), String> {
    delete_note_file(&notes_directory(&app)?, &file_name)
}

#[tauri::command]
fn import_legacy_markdown_notes(
    app: AppHandle,
    notes: Vec<LegacyMarkdownNote>,
) -> Result<bool, String> {
    let directory = notes_directory(&app)?;
    import_legacy_notes(&directory, notes)
}

#[cfg(test)]
mod tests {
    use super::{
        LegacyMarkdownNote, atomic_write, delete_note_file, import_legacy_notes, note_path,
        save_note_file,
    };
    use std::{
        fs,
        path::Path,
        sync::{
            Arc, Barrier,
            atomic::{AtomicU64, Ordering},
        },
    };

    static NEXT_TEMP_DIRECTORY_ID: AtomicU64 = AtomicU64::new(0);

    #[test]
    fn note_paths_accept_markdown_files_only() {
        assert!(note_path(Path::new("/notes"), "cell-biology--id.md").is_ok());
        assert!(note_path(Path::new("/notes"), "café & physics.md").is_ok());
        assert!(note_path(Path::new("/notes"), "notes.txt").is_err());
    }

    #[test]
    fn note_paths_reject_traversal_and_hidden_names() {
        assert!(note_path(Path::new("/notes"), "../outside.md").is_err());
        assert!(note_path(Path::new("/notes"), "..\\outside.md").is_err());
        assert!(note_path(Path::new("/notes"), "folder/note.md").is_err());
        assert!(note_path(Path::new("/notes"), ".private.md").is_err());
    }

    #[test]
    fn markdown_writes_replace_the_entire_existing_file() {
        let directory = temporary_notes_directory();
        let file = note_path(&directory, "cell-biology--note-1.md").unwrap();

        atomic_write(&file, "# First draft\n").unwrap();
        atomic_write(&file, "# Updated draft\n\n- [x] Saved\n").unwrap();

        assert_eq!(
            fs::read_to_string(&file).unwrap(),
            "# Updated draft\n\n- [x] Saved\n"
        );
        assert_eq!(fs::read_dir(&directory).unwrap().count(), 1);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn renaming_a_note_preserves_its_updated_markdown_and_removes_the_old_name() {
        let directory = temporary_notes_directory();
        save_note_file(&directory, None, "old-title--note-1.md", "# Original\n").unwrap();
        save_note_file(
            &directory,
            Some("old-title--note-1.md"),
            "new-title--note-1.md",
            "# Updated\n",
        )
        .unwrap();

        assert!(!directory.join("old-title--note-1.md").exists());
        assert_eq!(
            fs::read_to_string(directory.join("new-title--note-1.md")).unwrap(),
            "# Updated\n"
        );
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn deleting_a_note_removes_the_markdown_file() {
        let directory = temporary_notes_directory();
        save_note_file(&directory, None, "note--note-2.md", "# Keep\n").unwrap();
        delete_note_file(&directory, "note--note-2.md").unwrap();

        assert!(!directory.join("note--note-2.md").exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn legacy_import_is_idempotent_and_does_not_overwrite_existing_files() {
        let directory = temporary_notes_directory();
        save_note_file(&directory, None, "course--note-3.md", "# Newer content\n").unwrap();
        let legacy = vec![LegacyMarkdownNote {
            file_name: "course--note-3.md".to_string(),
            contents: "# Older content\n".to_string(),
        }];

        assert!(import_legacy_notes(&directory, legacy.clone()).unwrap());
        assert_eq!(
            fs::read_to_string(directory.join("course--note-3.md")).unwrap(),
            "# Newer content\n"
        );
        assert!(!import_legacy_notes(&directory, legacy).unwrap());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn concurrent_legacy_imports_are_serialized() {
        let directory = temporary_notes_directory();
        let notes = vec![LegacyMarkdownNote {
            file_name: "concurrent--note-4.md".to_string(),
            contents: "# Imported once\n".to_string(),
        }];
        let barrier = Arc::new(Barrier::new(3));

        let results = std::thread::scope(|scope| {
            let first_barrier = Arc::clone(&barrier);
            let first_directory = directory.clone();
            let first_notes = notes.clone();
            let first = scope.spawn(move || {
                first_barrier.wait();
                import_legacy_notes(&first_directory, first_notes)
            });

            let second_barrier = Arc::clone(&barrier);
            let second_directory = directory.clone();
            let second_notes = notes;
            let second = scope.spawn(move || {
                second_barrier.wait();
                import_legacy_notes(&second_directory, second_notes)
            });

            barrier.wait();
            [first.join().unwrap(), second.join().unwrap()]
        });

        assert_eq!(
            results
                .iter()
                .filter(|result| matches!(result, Ok(true)))
                .count(),
            1
        );
        assert_eq!(
            fs::read_to_string(directory.join("concurrent--note-4.md")).unwrap(),
            "# Imported once\n"
        );
        fs::remove_dir_all(directory).unwrap();
    }

    fn temporary_notes_directory() -> std::path::PathBuf {
        let unique = NEXT_TEMP_DIRECTORY_ID.fetch_add(1, Ordering::Relaxed);
        let directory =
            std::env::temp_dir().join(format!("studyspace-notes-{}-{unique}", std::process::id()));
        fs::create_dir(&directory).unwrap();
        directory
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            list_markdown_notes,
            save_markdown_note,
            delete_markdown_note,
            import_legacy_markdown_notes
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
