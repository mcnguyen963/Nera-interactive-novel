import { useState } from 'react'
import { useSettingsStore, useUiStore } from '../../stores'
import { fetchModels as fetchEdgeModels } from '../../lib/edgeApi'
import { Modal, Button } from '../shared'

export function SettingsModal() {
  const { llm, image, setLlm, setImage } = useSettingsStore()
  const { showSettings, closeSettings } = useUiStore()
  const [models, setModels] = useState<{ id: string; pricing?: { prompt: string } }[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  async function handleFetchModels() {
    setLoadingModels(true)
    try {
      const list = await fetchEdgeModels()
      setModels(list.filter((m) => !m.id.includes('embed')).sort((a, b) => a.id.localeCompare(b.id)))
    } catch {
      setModels([])
    } finally {
      setLoadingModels(false)
    }
  }

  async function handleTestConnection() {
    setTestResult('testing')
    try {
      const res = await fetch(llm.provider === 'openrouter' ? 'https://openrouter.ai/api/v1/models' : llm.localUrl + '/v1/models', {
        headers: llm.apiKey ? { Authorization: 'Bearer ' + llm.apiKey } : {},
        signal: AbortSignal.timeout(8000),
      })
      setTestResult(res.ok ? 'ok' : 'fail')
    } catch {
      setTestResult('fail')
    }
  }

  if (!showSettings) return null

  return (
    <Modal open={showSettings} onClose={closeSettings} className="w-[520px]">
      <div className="font-[var(--font-head)] text-[0.9rem] tracking-[0.15em] text-[var(--accent)] border-b border-[var(--rule)] pb-2.5 mb-2">
        Server & Generation Settings
      </div>

      <div className="font-[var(--font-head)] text-[0.78rem] tracking-[0.12em] text-[var(--ink3)] mt-1.5 mb-1">
        Language Model
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">Provider</label>
        <select
          value={llm.provider}
          onChange={(e) => setLlm({ provider: e.target.value as 'local' | 'openrouter' })}
          className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
        >
          <option value="local">Local (llama.cpp compatible)</option>
          <option value="openrouter">Cloud (OpenRouter)</option>
        </select>
      </div>

      {llm.provider === 'local' && (
        <div className="flex gap-2 mt-2">
          <div className="flex flex-col gap-1.5 flex-[2]">
            <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">API URL</label>
            <input
              value={llm.localUrl}
              onChange={(e) => setLlm({ localUrl: e.target.value })}
              className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">Model</label>
            <input
              value={llm.localModel}
              onChange={(e) => setLlm({ localModel: e.target.value })}
              className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
      )}

      {llm.provider === 'openrouter' && (
        <>
          <div className="flex gap-2 mt-2 items-end">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">Model</label>
              <select
                value={llm.openrouterModel}
                onChange={(e) => setLlm({ openrouterModel: e.target.value })}
                className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
              >
                <option value="">— select model —</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}{m.pricing?.prompt === '0' ? ' (free)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleFetchModels} disabled={loadingModels}>
              {loadingModels ? '…' : '↻ Refresh'}
            </Button>
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">API Key</label>
            <input
              type="password"
              value={llm.apiKey}
              onChange={(e) => setLlm({ apiKey: e.target.value })}
              placeholder="sk-… or your OpenRouter key"
              className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </>
      )}

      <div className="font-[var(--font-head)] text-[0.78rem] tracking-[0.12em] text-[var(--ink3)] mt-4 mb-1">
        Generation
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">
          Temperature: {llm.temperature.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={llm.temperature}
          onChange={(e) => setLlm({ temperature: parseFloat(e.target.value) })}
          className="w-full accent-[var(--accent)]"
        />
      </div>

      <div className="flex flex-col gap-1.5 mt-2">
        <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">Max tokens per response</label>
        <input
          type="number"
          value={llm.maxTokens}
          onChange={(e) => setLlm({ maxTokens: parseInt(e.target.value) || 1500 })}
          min={64}
          max={4096}
          className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div className="flex flex-col gap-1.5 mt-2">
        <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">Context window (chars)</label>
        <input
          type="number"
          value={llm.contextWindow}
          onChange={(e) => setLlm({ contextWindow: parseInt(e.target.value) || 3000 })}
          min={1000}
          max={100000}
          className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div className="flex flex-col gap-1.5 mt-2">
        <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">System prompt</label>
        <textarea
          value={llm.systemPrompt}
          onChange={(e) => setLlm({ systemPrompt: e.target.value })}
          rows={5}
          className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none resize-y min-h-[80px] leading-[1.55] focus:border-[var(--accent)]"
        />
      </div>

      <div className="font-[var(--font-head)] text-[0.78rem] tracking-[0.12em] text-[var(--ink3)] mt-4 mb-1">
        Image Generation
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">Provider</label>
        <select
          value={image.provider}
          onChange={(e) => setImage({ provider: e.target.value as 'local' | 'cloud' })}
          className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
        >
          <option value="local">Local (compatible API)</option>
          <option value="cloud">Cloud (OpenRouter / API)</option>
        </select>
      </div>

      {image.provider === 'local' && (
        <div className="flex flex-col gap-1.5 mt-2">
          <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">Image API URL</label>
          <input
            value={image.localUrl}
            onChange={(e) => setImage({ localUrl: e.target.value })}
            className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
          />
        </div>
      )}

      {image.provider === 'cloud' && (
        <div className="flex flex-col gap-1.5 mt-2">
          <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">Image API Key</label>
          <input
            type="password"
            value={image.cloudApiKey}
            onChange={(e) => setImage({ cloudApiKey: e.target.value })}
            className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5 mt-2">
        <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">Image Model</label>
        <input
          value={image.model}
          onChange={(e) => setImage({ model: e.target.value })}
          placeholder="e.g. flux, stable-diffusion, dall-e-3"
          className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div className="flex flex-col gap-1.5 mt-2">
        <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">
          CORS Proxy URL
          <span className="font-normal opacity-70 ml-1">(optional — for local servers without CORS)</span>
        </label>
        <input
          value={image.corsProxyUrl}
          onChange={(e) => setImage({ corsProxyUrl: e.target.value })}
          placeholder="e.g. http://localhost:3001"
          className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div className="flex gap-2 justify-end mt-4 pt-1">
        <Button onClick={handleTestConnection}>
          {testResult === 'testing' ? 'Testing…' : testResult === 'ok' ? 'Connected ✓' : testResult === 'fail' ? 'Failed' : 'Test connection'}
        </Button>
        <Button variant="primary" onClick={closeSettings}>
          Save & close
        </Button>
      </div>
    </Modal>
  )
}
