package interceptor

import _ "embed"

//go:embed background.js
var BackgroundJS string

//go:embed popup.html
var PopupHTML string

//go:embed popup.js
var PopupJS string
