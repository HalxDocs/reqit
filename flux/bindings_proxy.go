package main

import (
	proxypkg "flux/internal/proxy"
	reqpkg "flux/internal/requester"
)

func (a *App) GetProxyConfig() (string, error) {
	if a.proxyCfg == nil {
		return proxypkg.MarshalConfig(proxypkg.Config{})
	}
	return proxypkg.MarshalConfig(a.proxyCfg.Get())
}

func (a *App) SetProxyConfig(cfgJSON string) error {
	cfg, err := proxypkg.UnmarshalConfig(cfgJSON)
	if err != nil {
		return err
	}
	if a.proxyCfg != nil {
		if err := a.proxyCfg.Set(cfg); err != nil {
			return err
		}
	}
	reqpkg.SetGlobalProxy(cfg)
	return nil
}
