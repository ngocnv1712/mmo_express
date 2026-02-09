#!/bin/bash
# Run Tauri dev without snap GTK conflicts

# Clear snap GTK environment variables that conflict with system libraries
unset GTK_PATH
unset GDK_PIXBUF_MODULE_FILE
unset GIO_MODULE_DIR
unset GSETTINGS_SCHEMA_DIR
unset GTK_IM_MODULE_FILE
unset GTK_EXE_PREFIX
unset LOCPATH

# Start Vite dev server in background
npm run dev &
VITE_PID=$!

# Wait for Vite to start
sleep 3

# Run Tauri
cargo run --manifest-path src-tauri/Cargo.toml

# Cleanup
kill $VITE_PID 2>/dev/null
