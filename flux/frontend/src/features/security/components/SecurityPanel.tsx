import { useState, useEffect } from "react";
import { useUIStore } from "@/app/stores/useUIStore";
import { Button } from "@/shared/components/Button";
import {
  HasEncryptionKey, GenerateEncryptionKey, SetEncryptionPassphrase, DeleteEncryptionKey,
  ConfigureVault, GetVaultConfig, VaultGetSecret, VaultSetSecret,
  GetSSOProviders, AddSSOProvider, RemoveSSOProvider, ToggleSSOProvider, AuthenticateSSO,
  GetMaskingRules, AddMaskingRule, RemoveMaskingRule, ToggleMaskingRule, MaskText,
  QueryAuditLog, RBACCheck, RBACGrant, RBACRevoke, RBACList,
  GetAirGapConfig, SetAirGapConfig,
} from "../../../../wailsjs/go/main/App";

type SubTab = "e2ee" | "vault" | "sso" | "masking" | "audit" | "rbac" | "airgap";
const tabs: { key: SubTab; label: string }[] = [
  { key: "e2ee", label: "E2EE" },
  { key: "vault", label: "Secrets Vault" },
  { key: "sso", label: "SSO" },
  { key: "masking", label: "Data Masking" },
  { key: "audit", label: "Audit Trail" },
  { key: "rbac", label: "RBAC" },
  { key: "airgap", label: "Air-Gap" },
];

export function SecurityPanel() {
  const setView = useUIStore((s) => s.setView);
  const [tab, setTab] = useState<SubTab>("e2ee");
  const [msg, setMsg] = useState("");

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-bg">
      <header className="h-[48px] flex items-center gap-3 px-4 border-b border-border shrink-0">
        <button onClick={() => setView("http")} className="text-subtext hover:text-text text-13">&larr; Back</button>
        <h1 className="text-14 font-semibold text-text">Security &amp; Compliance</h1>
      </header>
      <div className="flex gap-1 px-4 py-2 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setMsg(""); }}
            className={`px-3 py-1.5 text-12 rounded-md transition-colors whitespace-nowrap ${
              tab === t.key ? "bg-cyan/10 text-cyan font-semibold" : "text-subtext hover:text-text hover:bg-cardHover"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {msg && <div className="mb-3 px-3 py-2 rounded-lg bg-cyan/10 text-cyan text-13 border border-cyan/20">{msg}</div>}
        {tab === "e2ee" && <E2EETab onMsg={setMsg} />}
        {tab === "vault" && <VaultTab onMsg={setMsg} />}
        {tab === "sso" && <SSOTab onMsg={setMsg} />}
        {tab === "masking" && <MaskingTab onMsg={setMsg} />}
        {tab === "audit" && <AuditTab onMsg={setMsg} />}
        {tab === "rbac" && <RBACTab onMsg={setMsg} />}
        {tab === "airgap" && <AirGapTab onMsg={setMsg} />}
      </div>
    </div>
  );
}

function E2EETab({ onMsg }: { onMsg: (m: string) => void }) {
  const [hasKey, setHasKey] = useState(false);
  const [pass, setPass] = useState("");

  useEffect(() => { HasEncryptionKey().then(setHasKey).catch(() => {}); }, []);

  const genKey = async () => {
    try {
      await GenerateEncryptionKey();
      setHasKey(true);
      onMsg("Encryption key generated and stored in OS keychain.");
    } catch (e) { onMsg(`Failed: ${e}`); }
  };
  const setKey = async () => {
    if (!pass) { onMsg("Enter a passphrase."); return; }
    try {
      await SetEncryptionPassphrase(pass);
      setHasKey(true);
      onMsg("Passphrase-derived key stored in OS keychain.");
    } catch (e) { onMsg(`Failed: ${e}`); }
  };
  const delKey = async () => {
    try {
      await DeleteEncryptionKey();
      setHasKey(false);
      onMsg("Encryption key deleted.");
    } catch (e) { onMsg(`Failed: ${e}`); }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-3">
        <span className="inline-block w-3 h-3 rounded-full bg-${hasKey ? 'green' : 'gray'}-500" />
        <span className="text-13 text-text">{hasKey ? "Encryption key is set" : "No encryption key"}</span>
      </div>
      <p className="text-12 text-subtext">AES-256-GCM encryption with keys stored in your OS keychain. Encrypts collections and environments at rest.</p>
      <div className="flex gap-2">
        <Button onClick={genKey} disabled={hasKey}>Generate Random Key</Button>
        <Button onClick={delKey} disabled={!hasKey}>Delete Key</Button>
      </div>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-12 text-subtext block mb-1">Passphrase (derives key)</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" />
        </div>
        <Button onClick={setKey} disabled={hasKey}>Set Passphrase</Button>
      </div>
    </div>
  );
}

function VaultTab({ onMsg }: { onMsg: (m: string) => void }) {
  const [vaultType, setVaultType] = useState("1password");
  const [token, setToken] = useState("");
  const [addr, setAddr] = useState("");
  const [region, setRegion] = useState("");
  const [path, setPath] = useState("");
  const [secretVal, setSecretVal] = useState("");
  const [retrieved, setRetrieved] = useState("");

  const configure = async () => {
    const cfg = { type: vaultType, token, addr, region };
    await ConfigureVault(JSON.stringify(cfg));
    onMsg(`Vault configured: ${vaultType}`);
  };
  const getSecret = async () => {
    try {
      const val = await VaultGetSecret(path);
      setRetrieved(val);
    } catch (e) { onMsg(String(e)); }
  };
  const setSecret = async () => {
    try {
      await VaultSetSecret(path, secretVal);
      onMsg("Secret stored.");
    } catch (e) { onMsg(String(e)); }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-2">
        <select value={vaultType} onChange={(e) => setVaultType(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text">
          <option value="1password">1Password</option>
          <option value="hashicorp">HashiCorp Vault</option>
          <option value="aws">AWS Secrets Manager</option>
        </select>
        <Button onClick={configure}>Configure Vault</Button>
      </div>
      {vaultType === "hashicorp" && (
        <div><label className="text-12 text-subtext block">Vault Address</label>
          <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="https://vault.example.com:8200"
            className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
      )}
      {vaultType === "aws" && (
        <div><label className="text-12 text-subtext block">AWS Region</label>
          <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="us-east-1"
            className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
      )}
      <div><label className="text-12 text-subtext block">Token / Service Account</label>
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
      <div className="border-t border-border pt-4">
        <h3 className="text-13 font-semibold text-text mb-2">Read / Write Secrets</h3>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-12 text-subtext block">Secret Path</label>
            <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="vault/item or path/to/secret"
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
          <div><label className="text-12 text-subtext block">Value to Write</label>
            <input value={secretVal} onChange={(e) => setSecretVal(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
        </div>
        <div className="flex gap-2 mt-2">
          <Button onClick={getSecret}>Read Secret</Button>
          <Button onClick={setSecret}>Write Secret</Button>
        </div>
        {retrieved && <pre className="mt-2 text-12 text-subtext bg-surface p-2 rounded-lg">{retrieved}</pre>}
      </div>
    </div>
  );
}

function SSOTab({ onMsg }: { onMsg: (m: string) => void }) {
  const [providersJSON, setProvidersJSON] = useState("[]");
  const [ssoType, setSsoType] = useState("oidc");
  const [providerID, setProviderID] = useState("");
  const [providerName, setProviderName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [clientID, setClientID] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [idpURL, setIdpURL] = useState("");
  const [idpCert, setIdpCert] = useState("");
  const [emailHint, setEmailHint] = useState("");

  useEffect(() => { GetSSOProviders().then(setProvidersJSON).catch(() => {}); }, []);

  const addProvider = async () => {
    const cfg: any = { id: providerID, name: providerName, type: ssoType, enabled: true };
    if (ssoType === "oidc") cfg.oidc = { issuerUrl: issuer, clientId: clientID, clientSecret, scopes: ["openid", "profile", "email"], redirectUrl: "http://localhost:9853/callback" };
    if (ssoType === "saml") cfg.saml = { idpSsoUrl: idpURL, idpEntityId: providerID, idpCert, spEntityId: "reqit", spAcsUrl: "http://localhost:9853/acs", attributeEmail: "email", attributeName: "name" };
    try {
      await AddSSOProvider(JSON.stringify(cfg));
      setProvidersJSON(await GetSSOProviders());
      onMsg(`SSO provider "${providerID}" added.`);
    } catch (e) { onMsg(String(e)); }
  };

  const removeProvider = async (id: string) => {
    try {
      await RemoveSSOProvider(id);
      setProvidersJSON(await GetSSOProviders());
    } catch (e) { onMsg(`Failed: ${e}`); }
  };

  const toggleProvider = async (id: string) => {
    try {
      await ToggleSSOProvider(id);
      setProvidersJSON(await GetSSOProviders());
    } catch (e) { onMsg(`Failed: ${e}`); }
  };

  const authProvider = async (id: string) => {
    try {
      const profile = await AuthenticateSSO(id, emailHint);
      onMsg(`Authenticated: ${profile}`);
    } catch (e) { onMsg(String(e)); }
  };

  const renderProviders = () => {
    try { return JSON.parse(providersJSON); } catch { return []; }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex gap-2 items-end">
        <select value={ssoType} onChange={(e) => setSsoType(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text">
          <option value="oidc">OpenID Connect</option>
          <option value="saml">SAML 2.0</option>
        </select>
        <div className="flex-1"><label className="text-12 text-subtext block">Provider ID</label>
          <input value={providerID} onChange={(e) => setProviderID(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
        <div className="flex-1"><label className="text-12 text-subtext block">Name</label>
          <input value={providerName} onChange={(e) => setProviderName(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
      </div>
      {ssoType === "oidc" && (
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-12 text-subtext block">Issuer URL</label>
            <input value={issuer} onChange={(e) => setIssuer(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
          <div><label className="text-12 text-subtext block">Client ID</label>
            <input value={clientID} onChange={(e) => setClientID(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
          <div className="col-span-2"><label className="text-12 text-subtext block">Client Secret</label>
            <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
        </div>
      )}
      {ssoType === "saml" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2"><label className="text-12 text-subtext block">IdP SSO URL</label>
            <input value={idpURL} onChange={(e) => setIdpURL(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
          <div className="col-span-2"><label className="text-12 text-subtext block">IdP Certificate (PEM)</label>
            <textarea value={idpCert} onChange={(e) => setIdpCert(e.target.value)} rows={3}
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text font-mono" /></div>
        </div>
      )}
      <Button onClick={addProvider}>Add Provider</Button>
      <div className="border-t border-border pt-4">
        <h3 className="text-13 font-semibold text-text mb-2">Configured Providers</h3>
        {renderProviders().length === 0 ? (
          <p className="text-12 text-subtext">No SSO providers configured.</p>
        ) : (
          <div className="space-y-2">
            {renderProviders().map((p: any) => (
              <div key={p.id} className="flex items-center gap-2 bg-surface px-3 py-2 rounded-lg border border-border">
                <span className={`inline-block w-2 h-2 rounded-full ${p.enabled ? "bg-green-500" : "bg-gray-500"}`} />
                <span className="text-13 text-text flex-1">{p.name} ({p.type})</span>
                <Button onClick={() => toggleProvider(p.id)}>{p.enabled ? "Disable" : "Enable"}</Button>
                <Button onClick={() => authProvider(p.id)}>Test Auth</Button>
                <button onClick={() => removeProvider(p.id)} className="text-11 text-red-500 hover:text-red-400">&times;</button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <label className="text-12 text-subtext block">Email hint for test auth</label>
          <input value={emailHint} onChange={(e) => setEmailHint(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" />
        </div>
      </div>
    </div>
  );
}

function MaskingTab({ onMsg }: { onMsg: (m: string) => void }) {
  const [rulesJSON, setRulesJSON] = useState("[]");
  const [testInput, setTestInput] = useState("");
  const [maskedOutput, setMaskedOutput] = useState("");
  const [newName, setNewName] = useState("");
  const [newPattern, setNewPattern] = useState("");
  const [newReplace, setNewReplace] = useState("");

  useEffect(() => { GetMaskingRules().then(setRulesJSON).catch(() => {}); }, []);

  const renderRules = () => {
    try { return JSON.parse(rulesJSON); } catch { return []; }
  };

  const addRule = async () => {
    if (!newName || !newPattern) { onMsg("Name and pattern required."); return; }
    try {
      await AddMaskingRule(newName, newPattern, newReplace || "★★★★★");
      setRulesJSON(await GetMaskingRules());
      onMsg(`Rule "${newName}" added.`);
    } catch (e) { onMsg(String(e)); }
  };

  const removeRule = async (name: string) => {
    await RemoveMaskingRule(name);
    setRulesJSON(await GetMaskingRules());
  };

  const toggleRule = async (name: string, enabled: boolean) => {
    await ToggleMaskingRule(name, enabled);
    setRulesJSON(await GetMaskingRules());
  };

  const testMask = async () => {
    const masked = await MaskText(testInput);
    setMaskedOutput(masked);
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-12 text-amber-500">
        <strong>Note:</strong> Masking is applied to console logs and UI display only. Raw data is never modified.
      </div>
      <div className="border border-border rounded-lg p-3">
        <h3 className="text-13 font-semibold text-text mb-2">Test Masking</h3>
        <textarea value={testInput} onChange={(e) => setTestInput(e.target.value)} rows={3}
          placeholder="Paste text with tokens, secrets, etc."
          className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text font-mono" />
        <Button onClick={testMask}>Mask</Button>
        {maskedOutput && (
          <pre className="mt-2 text-12 text-subtext bg-surface p-2 rounded-lg whitespace-pre-wrap">{maskedOutput}</pre>
        )}
      </div>
      <div className="border border-border rounded-lg p-3">
        <h3 className="text-13 font-semibold text-text mb-2">Add Custom Rule</h3>
        <div className="grid grid-cols-3 gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Rule name"
            className="px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" />
          <input value={newPattern} onChange={(e) => setNewPattern(e.target.value)} placeholder="Regex pattern"
            className="px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text font-mono" />
          <input value={newReplace} onChange={(e) => setNewReplace(e.target.value)} placeholder="Replacement"
            className="px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" />
        </div>
        <Button onClick={addRule}>Add Rule</Button>
      </div>
      <div>
        <h3 className="text-13 font-semibold text-text mb-2">Active Rules ({renderRules().length})</h3>
        <div className="space-y-1">
          {renderRules().map((r: any) => (
            <div key={r.name} className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-lg border border-border">
              <span className={`inline-block w-2 h-2 rounded-full ${r.enabled ? "bg-green-500" : "bg-gray-500"}`} />
              <span className="text-13 text-text flex-1">{r.name}</span>
              <span className="text-11 text-subtext font-mono truncate max-w-[200px]">{r.pattern}</span>
              <button onClick={() => toggleRule(r.name, !r.enabled)}
                className="text-11 text-subtext hover:text-text">{r.enabled ? "Disable" : "Enable"}</button>
              <button onClick={() => removeRule(r.name)} className="text-11 text-red-500 hover:text-red-400">&times;</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditTab({ onMsg }: { onMsg: (m: string) => void }) {
  const [entriesJSON, setEntriesJSON] = useState("[]");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");

  const query = async () => {
    try {
      const data = await QueryAuditLog(100, 0, actor, action, "", "");
      setEntriesJSON(data);
    } catch (e) { onMsg(String(e)); }
  };
  useEffect(() => { query(); }, []);

  const renderEntries = () => {
    try { return JSON.parse(entriesJSON); } catch { return []; }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-12 text-subtext">Structured audit log capturing all operational events in the workspace.</p>
      <div className="flex gap-2 items-end">
        <div><label className="text-12 text-subtext block">Actor</label>
          <input value={actor} onChange={(e) => setActor(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
        <div><label className="text-12 text-subtext block">Action</label>
          <input value={action} onChange={(e) => setAction(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
        <Button onClick={query}>Query</Button>
      </div>
      <div className="space-y-1 max-h-[500px] overflow-y-auto">
        {renderEntries().map((e: any, i: number) => (
          <div key={i} className="flex items-start gap-2 bg-surface px-3 py-2 rounded-lg border border-border text-12">
            <span className="text-10 text-subtext/50 font-mono shrink-0">{new Date(e.ts).toLocaleString()}</span>
            <span className="text-cyan font-semibold shrink-0">{e.actor}</span>
            <span className="text-subtext shrink-0">{e.action}</span>
            <span className="text-text shrink-0">{e.resource}/{e.resourceId}</span>
            {e.details && <span className="text-10 text-subtext truncate">{JSON.stringify(e.details)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function RBACTab({ onMsg }: { onMsg: (m: string) => void }) {
  const [acesJSON, setAcesJSON] = useState("[]");
  const [userID, setUserID] = useState("");
  const [resourceID, setResourceID] = useState("");
  const [resType, setResType] = useState("collection");
  const [role, setRole] = useState("viewer");
  const [checkPerm, setCheckPerm] = useState("read");
  const [checkResult, setCheckResult] = useState<boolean | null>(null);

  const refresh = async () => {
    setAcesJSON(await RBACList("", ""));
  };
  useEffect(() => { refresh(); }, []);

  const grant = async () => {
    if (!userID || !resourceID) { onMsg("User and resource required."); return; }
    await RBACGrant(userID, resourceID, resType, role);
    await refresh();
    onMsg(`Granted ${role} to ${userID} on ${resourceID}.`);
  };
  const revoke = async () => {
    await RBACRevoke(userID, resourceID);
    await refresh();
    onMsg(`Revoked ${userID} from ${resourceID}.`);
  };
  const check = async () => {
    const result = await RBACCheck(userID, resourceID, resType, checkPerm);
    setCheckResult(result);
  };

  const renderACEs = () => {
    try { return JSON.parse(acesJSON); } catch { return []; }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-12 text-subtext block">User ID</label>
          <input value={userID} onChange={(e) => setUserID(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
        <div><label className="text-12 text-subtext block">Resource ID</label>
          <input value={resourceID} onChange={(e) => setResourceID(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text" /></div>
        <div><label className="text-12 text-subtext block">Resource Type</label>
          <select value={resType} onChange={(e) => setResType(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text">
            <option value="collection">Collection</option>
            <option value="environment">Environment</option>
            <option value="workspace">Workspace</option>
            <option value="spec">Spec</option>
            <option value="mock">Mock</option>
            <option value="settings">Settings</option>
          </select></div>
        <div><label className="text-12 text-subtext block">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text">
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select></div>
      </div>
      <div className="flex gap-2">
        <Button onClick={grant}>Grant Access</Button>
        <Button onClick={revoke}>Revoke Access</Button>
      </div>
      <div className="border-t border-border pt-4">
        <h3 className="text-13 font-semibold text-text mb-2">Check Permission</h3>
        <div className="flex gap-2 items-end">
          <div><label className="text-12 text-subtext block">Permission</label>
            <select value={checkPerm} onChange={(e) => setCheckPerm(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-surface border border-border text-13 text-text">
              <option value="read">Read</option>
              <option value="write">Write</option>
              <option value="delete">Delete</option>
              <option value="share">Share</option>
              <option value="export">Export</option>
              <option value="manage">Manage</option>
            </select></div>
          <Button onClick={check}>Check</Button>
          {checkResult !== null && (
            <span className={`text-13 font-semibold ${checkResult ? "text-green-500" : "text-red-500"}`}>
              {checkResult ? "ALLOWED" : "DENIED"}
            </span>
          )}
        </div>
      </div>
      <div className="border-t border-border pt-4">
        <h3 className="text-13 font-semibold text-text mb-2">Access Control Entries</h3>
        {renderACEs().map((ace: any, i: number) => (
          <div key={i} className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-lg border border-border text-12 mb-1">
            <span className="text-cyan">{ace.userId}</span>
            <span className="text-subtext">→</span>
            <span className="text-text">{ace.resourceId} ({ace.resourceType})</span>
            <span className="text-subtext">as</span>
            <span className="font-semibold">{ace.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AirGapTab({ onMsg }: { onMsg: (m: string) => void }) {
  const [cfgJSON, setCfgJSON] = useState("{}");
  useEffect(() => { GetAirGapConfig().then(setCfgJSON).catch(() => {}); }, []);
  const cfg = (() => { try { return JSON.parse(cfgJSON); } catch { return {}; } })();

  const toggle = async (field: string) => {
    const next = { ...cfg, [field]: !cfg[field] };
    await SetAirGapConfig(JSON.stringify(next));
    setCfgJSON(await GetAirGapConfig());
  };

  const fields: { key: string; label: string }[] = [
    { key: "networkDisabled", label: "All Network Access" },
    { key: "updateCheckDisabled", label: "Update Checks" },
    { key: "pluginDownloadsDisabled", label: "Plugin Downloads" },
    { key: "registrySyncDisabled", label: "Registry Sync" },
    { key: "telemetryDisabled", label: "Telemetry" },
    { key: "interceptorDisabled", label: "Browser Interceptor" },
    { key: "vaultAccessDisabled", label: "Vault Access" },
    { key: "ssoDisabled", label: "SSO" },
  ];

  return (
    <div className="space-y-4 max-w-lg">
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-12 text-red-500">
        <strong>Air-Gapped Mode</strong> — Enabling network isolation disables all external communication.
        Suitable for defense, banking, and other security-sensitive environments.
      </div>
      <div className="space-y-2">
        {fields.map((f) => (
          <label key={f.key} className="flex items-center gap-3 cursor-pointer bg-surface px-3 py-2 rounded-lg border border-border">
            <input type="checkbox" checked={!!cfg[f.key]}
              onChange={() => toggle(f.key)}
              className="w-4 h-4 rounded border-border accent-cyan" />
            <span className="text-13 text-text">{f.label}</span>
            <span className={`ml-auto text-11 ${cfg[f.key] ? 'text-red-500' : 'text-green-500'}`}>
              {cfg[f.key] ? "Disabled" : "Enabled"}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
