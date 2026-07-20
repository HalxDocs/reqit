package main

import (
	"errors"

	"flux/internal/audit"
	"flux/internal/masker"
	"flux/internal/profile"
	"flux/internal/rbac"
	"flux/internal/sso"
	"flux/internal/vault"
)

func (a *App) HasEncryptionKey() bool {
	if a.crypto == nil {
		return false
	}
	return a.crypto.HasKey()
}

func (a *App) GenerateEncryptionKey() error {
	if a.crypto == nil {
		return errors.New("crypto not initialised")
	}
	if a.audit != nil {
		_ = a.audit.Log("system", audit.ActionConfig, "crypto", "key", "", map[string]string{"action": "generate"})
	}
	return a.crypto.GenerateKey()
}

func (a *App) SetEncryptionPassphrase(passphrase string) error {
	if a.crypto == nil {
		return errors.New("crypto not initialised")
	}
	if a.audit != nil {
		_ = a.audit.Log("system", audit.ActionConfig, "crypto", "passphrase", "", nil)
	}
	return a.crypto.SetKey(passphrase)
}

func (a *App) DeleteEncryptionKey() error {
	if a.crypto == nil {
		return errors.New("crypto not initialised")
	}
	if a.audit != nil {
		_ = a.audit.Log("system", audit.ActionConfig, "crypto", "key", "", map[string]string{"action": "delete"})
	}
	return a.crypto.DeleteKey()
}

// --- Security: Secret Vault ---

func (a *App) ConfigureVault(cfgJSON string) error {
	if a.airgap != nil && a.airgap.Get().VaultAccessDisabled {
		return errors.New("vault access disabled by air-gap configuration")
	}
	cfg, err := vault.UnmarshalConfig(cfgJSON)
	if err != nil {
		return err
	}
	p, err := vault.New(cfg)
	if err != nil {
		return err
	}
	a.vault = p
	a.vaultCfg = cfg
	if a.audit != nil {
		_ = a.audit.Log("system", audit.ActionConfig, "vault", cfg.Type, "", nil)
	}
	return nil
}

func (a *App) GetVaultConfig() string {
	data, _ := vault.MarshalConfig(a.vaultCfg)
	return data
}

func (a *App) VaultGetSecret(path string) (string, error) {
	if a.vault == nil {
		return "", errors.New("no vault configured")
	}
	if a.airgap != nil && a.airgap.Get().VaultAccessDisabled {
		return "", errors.New("vault access disabled by air-gap configuration")
	}
	return a.vault.GetSecret(path)
}

func (a *App) VaultSetSecret(path, value string) error {
	if a.vault == nil {
		return errors.New("no vault configured")
	}
	if a.airgap != nil && a.airgap.Get().VaultAccessDisabled {
		return errors.New("vault access disabled by air-gap configuration")
	}
	return a.vault.SetSecret(path, value)
}

// --- Security: Enterprise SSO ---

func (a *App) GetSSOProviders() string {
	if a.sso == nil {
		return "[]"
	}
	providers := a.sso.List()
	data, _ := sso.MarshalProviders(providers)
	return data
}

func (a *App) AddSSOProvider(cfgJSON string) error {
	if a.sso == nil {
		return errors.New("sso not initialised")
	}
	cfg, err := sso.UnmarshalProvider(cfgJSON)
	if err != nil {
		return err
	}
	if err := a.sso.Add(cfg); err != nil {
		return err
	}
	if a.audit != nil {
		_ = a.audit.Log("system", audit.ActionConfig, "sso", cfg.ID, "", nil)
	}
	return a.sso.Save()
}

func (a *App) RemoveSSOProvider(id string) error {
	if a.sso == nil {
		return errors.New("sso not initialised")
	}
	if err := a.sso.Remove(id); err != nil {
		return err
	}
	return a.sso.Save()
}

func (a *App) ToggleSSOProvider(id string) error {
	if a.sso == nil {
		return errors.New("sso not initialised")
	}
	if err := a.sso.ToggleEnabled(id); err != nil {
		return err
	}
	return a.sso.Save()
}

func (a *App) AuthenticateSSO(providerID, emailHint string) (string, error) {
	if a.sso == nil {
		return "", errors.New("sso not initialised")
	}
	if a.airgap != nil && a.airgap.Get().SSODisabled {
		return "", errors.New("SSO disabled by air-gap configuration")
	}
	profile, err := a.sso.Authenticate(providerID, emailHint)
	if err != nil {
		return "", err
	}
	if a.audit != nil {
		_ = a.audit.Log(profile.Email, audit.ActionLogin, "sso", providerID, "", nil)
	}
	data, _ := sso.MarshalUserProfile(profile)
	return data, nil
}

// --- Security: Data Masking ---

func (a *App) GetMaskingRules() string {
	if a.masker == nil {
		return "[]"
	}
	rules := a.masker.List()
	data, _ := masker.MarshalRules(rules)
	return data
}

func (a *App) AddMaskingRule(name, pattern, replacement string) error {
	if a.masker == nil {
		return errors.New("masker not initialised")
	}
	return a.masker.AddRule(name, pattern, replacement)
}

func (a *App) RemoveMaskingRule(name string) {
	if a.masker != nil {
		a.masker.RemoveRule(name)
	}
}

func (a *App) ToggleMaskingRule(name string, enabled bool) {
	if a.masker != nil {
		a.masker.SetEnabled(name, enabled)
	}
}

func (a *App) MaskText(text string) string {
	if a.masker == nil {
		return text
	}
	return a.masker.Mask(text)
}

// --- Security: Audit Trail ---

func (a *App) QueryAuditLog(limit, offset int, actor, action, resource, workspaceID string) string {
	if a.audit == nil {
		return "[]"
	}
	entries, err := a.audit.Query(limit, offset, actor, action, resource, workspaceID)
	if err != nil {
		return "[]"
	}
	data, _ := audit.MarshalEntries(entries)
	return string(data)
}

// --- Security: RBAC ---

func (a *App) RBACCheck(userID, resourceID, resourceType, permission string) bool {
	if a.rbac == nil {
		return true
	}
	return a.rbac.Check(userID, resourceID, rbac.ResourceType(resourceType), rbac.Permission(permission))
}

func (a *App) RBACGrant(userID, resourceID, resourceType, role string) error {
	if a.rbac == nil {
		return errors.New("rbac not initialised")
	}
	return a.rbac.Grant(userID, resourceID, rbac.ResourceType(resourceType), rbac.Role(role))
}

func (a *App) RBACRevoke(userID, resourceID string) error {
	if a.rbac == nil {
		return errors.New("rbac not initialised")
	}
	return a.rbac.Revoke(userID, resourceID)
}

func (a *App) RBACList(userID, resourceID string) string {
	if a.rbac == nil {
		return "[]"
	}
	entries := a.rbac.List(userID, resourceID)
	data, _ := rbac.MarshalACEs(entries)
	return data
}

// --- Security: Air-Gapped Configuration ---

func (a *App) GetAirGapConfig() string {
	if a.airgap == nil {
		cfg := profile.AirGapConfig{}
		data, _ := profile.MarshalAirGap(cfg)
		return data
	}
	cfg := a.airgap.Get()
	data, _ := profile.MarshalAirGap(cfg)
	return data
}

func (a *App) SetAirGapConfig(cfgJSON string) error {
	if a.airgap == nil {
		return errors.New("airgap not initialised")
	}
	cfg, err := profile.UnmarshalAirGap(cfgJSON)
	if err != nil {
		return err
	}
	return a.airgap.Set(cfg)
}
