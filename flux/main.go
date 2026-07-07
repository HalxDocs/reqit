package main

import (
	"embed"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	"flux/internal/cli"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// If the first arg is a CLI command, run headlessly.
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "run", "list", "help", "--help", "-h":
			os.Exit(cli.Run(os.Args[1:]))
		case "mcp":
			os.Exit(cli.RunMCP(os.Args[2:]))
		}
	}

	app := NewApp()

	err := wails.Run(&options.App{
		Title:  "reqit",
		Width:  1280,
		Height: 800,
		MinWidth:  1024,
		MinHeight: 640,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 0x0D, G: 0x0D, B: 0x0D, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
