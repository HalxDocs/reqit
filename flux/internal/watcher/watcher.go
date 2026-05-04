package watcher

import (
	"log"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

type Handler func(filename string)

type Watcher struct {
	fw      *fsnotify.Watcher
	handler Handler
	timer   *time.Timer
	mu      sync.Mutex
	done    chan struct{}
}

func New(handler Handler) (*Watcher, error) {
	fw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	w := &Watcher{fw: fw, handler: handler, done: make(chan struct{})}
	go w.loop()
	return w, nil
}

func (w *Watcher) Watch(dirs ...string) error {
	for _, dir := range dirs {
		if err := w.fw.Add(dir); err != nil {
			return err
		}
	}
	return nil
}

func (w *Watcher) loop() {
	for {
		select {
		case <-w.done:
			return
		case event, ok := <-w.fw.Events:
			if !ok {
				return
			}
			if event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Remove|fsnotify.Rename) != 0 {
				name := event.Name
				w.mu.Lock()
				if w.timer != nil {
					w.timer.Stop()
				}
				w.timer = time.AfterFunc(200*time.Millisecond, func() {
					w.handler(name)
				})
				w.mu.Unlock()
			}
		case err, ok := <-w.fw.Errors:
			if !ok {
				return
			}
			log.Println("watcher:", err)
		}
	}
}

func (w *Watcher) Close() {
	close(w.done)
	_ = w.fw.Close()
}
