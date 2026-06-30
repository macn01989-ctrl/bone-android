import { Check, DatabaseBackup, Save } from 'lucide-react';
import type { ApiCapability, ApiConfig, ApiInterfaceType } from '../../shared/types';
import { capabilityLabels, interfaceOptions } from '../../shared/apiMeta';

export function ApiPanel({
  capability,
  config,
  onChange,
  onToast,
}: {
  capability: ApiCapability;
  config: ApiConfig;
  onChange: (patch: Partial<ApiConfig>) => void;
  onToast: (message: string) => void;
}) {
  const meta = capabilityLabels[capability];
  const Icon = meta.icon;

  const testConfig = () => {
    if (!config.baseUrl.trim() || !config.model.trim()) {
      onToast('请先填写 Base URL 和模型');
      return;
    }

    if (!config.apiKey.trim()) {
      onToast('请先填写 API Key');
      return;
    }

    onToast('配置格式可用');
  };

  return (
    <article className="api-panel">
      <div className="api-panel-head">
        <Icon size={20} />
        <div>
          <h3>{meta.title}</h3>
          <p>{meta.hint}</p>
        </div>
      </div>

      <label className="field-row">
        <span>接口类型</span>
        <select
          value={config.interfaceType}
          onChange={(event) => onChange({ interfaceType: event.target.value as ApiInterfaceType })}
        >
          {interfaceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field-row">
        <span>Base URL</span>
        <input
          value={config.baseUrl}
          onChange={(event) => onChange({ baseUrl: event.target.value })}
          placeholder="https://api.example.com/v1/chat/completions"
          spellCheck={false}
        />
      </label>

      <label className="field-row">
        <span>API Key</span>
        <input
          value={config.apiKey}
          onChange={(event) => onChange({ apiKey: event.target.value })}
          placeholder="sk-..."
          type="password"
          spellCheck={false}
        />
      </label>

      <label className="field-row">
        <span>模型 / Bot ID</span>
        <input
          value={config.model}
          onChange={(event) => onChange({ model: event.target.value })}
          placeholder={config.interfaceType === 'ark-bot' ? 'bot-xxxxxxxx' : 'model-name'}
          spellCheck={false}
        />
      </label>

      <div className="api-panel-actions">
        <button type="button" onClick={() => onChange({ enabled: !config.enabled })}>
          {config.enabled ? <Check size={18} /> : <Save size={18} />}
          <span>{config.enabled ? '已启用' : '启用'}</span>
        </button>
        <button type="button" onClick={testConfig}>
          <DatabaseBackup size={18} />
          <span>测试</span>
        </button>
      </div>
    </article>
  );
}
