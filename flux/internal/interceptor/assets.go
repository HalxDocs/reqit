package interceptor

import (
	_ "embed"
)

//go:embed background.js
var BackgroundJS string

//go:embed popup.html
var PopupHTML string

//go:embed popup.js
var PopupJS string

//go:embed icons/icon16.png
var Icon16 []byte

//go:embed icons/icon48.png
var Icon48 []byte

//go:embed icons/icon128.png
var Icon128 []byte
