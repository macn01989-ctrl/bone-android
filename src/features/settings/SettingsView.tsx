import { useMemo, useRef } from 'react';
import { Check, ChevronLeft, Download, Upload } from 'lucide-react';
import { buildSettingsBackup, downloadBlob, readSettingsFromBackup } from '../../services/backup';
import type { ApiCapability, ApiConfig, AppSettings, BoneNote } from '../../shared/types';
import { ApiPanel } from './ApiPanel';

export function SettingsView({
  settings,
  notes,
  onBack,
  onSave,
  onRestoreNotes,
  onToast,
}: {
  settings: AppSettings;
  notes: BoneNote[];
  onBack: () => void;
  onSave: (settings: AppSettings, message?: string) => Promise<void>;
  onRestoreNotes: (notes: BoneNote[], mode: AppSettings['backupMode']) => Promise<void>;
  onToast: (message: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const backupName = useMemo(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    return `bone-backup-${stamp}.zip`;
  }, []);

  const updateApi = (capability: ApiCapability, patch: Partial<ApiConfig>) => {
    void onSave(
      {
        ...settings,
        api: {
          ...settings.api,
          [capability]: {
            ...settings.api[capability],
            ...patch,
          },
        },
      },
      '配置已保存',
    );
  };

  const handleExport = async () => {
    const backup = await buildSettingsBackup(settings, settings.includeApiKeysInBackup, notes);
    downloadBlob(backup, backupName);
    onToast('备份包已生成');
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;

    try {
      const imported = await readSettingsFromBackup(file);
      const mode = settings.backupMode;
      await onSave(
        {
          ...settings,
          ...imported.settings,
          api: {
            ...settings.api,
            ...imported.settings.api,
          },
          includeApiKeysInBackup: false,
          backupMode: mode,
        },
        '配置已从备份导入',
      );

      if (imported.notes.length > 0) {
        await onRestoreNotes(imported.notes, mode);
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : '导入失败');
    }
  };

  return (
    <section className="settings-screen">
      <header className="top-bar">
        <button className="icon-button" type="button" onClick={onBack} aria-label="返回主页">
          <ChevronLeft size={26} />
        </button>
        <h1>设置</h1>
        <div className="top-spacer" />
      </header>

      <div className="settings-content">
        <section className="settings-section">
          <h2>API 配置</h2>
          <div className="api-grid">
            {(Object.keys(settings.api) as ApiCapability[]).map((capability) => (
              <ApiPanel
                key={capability}
                capability={capability}
                config={settings.api[capability]}
                onChange={(patch) => updateApi(capability, patch)}
                onToast={onToast}
              />
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h2>Apple 搜索</h2>
          <div className="locked-row">
            <Check size={20} />
            <span>iTunes Search API 已内置，用于专辑、播客、封面搜索，不需要填写 Key。</span>
          </div>
        </section>

        <section className="settings-section">
          <h2>备份与恢复</h2>
          <div className="backup-grid">
            <button className="action-tile" type="button" onClick={handleExport}>
              <Download size={22} />
              <span>导出备份</span>
            </button>
            <button className="action-tile" type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={22} />
              <span>导入恢复</span>
            </button>
          </div>

          <div className="settings-toggle-row">
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.includeApiKeysInBackup}
                onChange={(event) =>
                  void onSave({
                    ...settings,
                    includeApiKeysInBackup: event.target.checked,
                  })
                }
              />
              <span />
            </label>
            <span>备份 API Key</span>
          </div>

          <div className="segmented">
            <button
              className={settings.backupMode === 'merge' ? 'selected' : ''}
              type="button"
              onClick={() => void onSave({ ...settings, backupMode: 'merge' })}
            >
              合并恢复
            </button>
            <button
              className={settings.backupMode === 'replace' ? 'selected' : ''}
              type="button"
              onClick={() => void onSave({ ...settings, backupMode: 'replace' })}
            >
              覆盖恢复
            </button>
          </div>

          <input
            ref={fileInputRef}
            className="hidden-input"
            type="file"
            accept=".zip,application/zip"
            onChange={(event) => void handleImport(event.target.files?.[0])}
          />
        </section>
      </div>
    </section>
  );
}
