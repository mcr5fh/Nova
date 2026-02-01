// This helps auto-generate libraries you can use in the language of your choice.
generator target {
    // Python/Pydantic for this project
    output_type "python/pydantic"

    // Where the generated code will be saved (relative to baml_src/)
    // BAML will create a baml_client/ subdirectory within this path
    output_dir "../agent_loop_server"
    version "0.207.1"
    default_client_mode async
   
}
