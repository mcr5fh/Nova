generator target {
  output_type "go"
  output_dir "../"
  client_package_name "github.com/mattruiters/nova"
  version "0.218.1"
  default_client_mode "sync"
  on_generate "gofmt -w . && goimports -w ."
}
