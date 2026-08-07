import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ApiResponse, AppSettings, BackendKind, BackendTestResult, DownloadItem, DownloadProgress, EnvironmentReport, GenerationMode, GenerationRequest, GenerationTask } from "../shared/types";
import { estimateCloudCost } from "../shared/capabilities";

type Page = "ready" | "studio" | "downloads" | "guide" | "connections";
const pages: Array<{ id: Page; icon: string; label: string }> = [
  { id: "ready", icon: "◌", label: "就绪检测" }, { id: "studio", icon: "✦", label: "生成工作台" },
  { id: "downloads", icon: "↓", label: "模型下载" }, { id: "guide", icon: "?", label: "配置指南" },
  { id: "connections", icon: "⌁", label: "连接设置" }
];
const initialRequest: GenerationRequest = { mode: "text", backend: "local", prompt: "", duration: 6, ratio: "16:9", resolution: "768P", width: 1280, height: 720, count: 4, baseSeed: Math.floor(Math.random() * 1_000_000) };

export function App() {
  const [page, setPage] = useState<Page>("ready");
  const [settings, setSettings] = useState<AppSettings>();
  const [report, setReport] = useState<EnvironmentReport>();
  const [manifest, setManifest] = useState<DownloadItem[]>([]);
  const [downloads, setDownloads] = useState<DownloadProgress[]>([]);
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const [detecting, setDetecting] = useState(false);
  const showError = (error: unknown) => setNotice({ text: error instanceof Error ? error.message : String(error || "操作失败"), error: true });

  useEffect(() => {
    Promise.all([window.h3.getSettings(), window.h3.getDownloadManifest(), window.h3.listDownloads(), window.h3.listTasks()])
      .then(([s, m, d, t]) => { if (s.data) setSettings(s.data); if (m.data) setManifest(m.data); if (d.data) setDownloads(d.data); if (t.data) setTasks(t.data); }).catch(showError);
    const offDownload = window.h3.onDownloadUpdate((item) => setDownloads((all) => upsert(all, item)));
    const offTask = window.h3.onTaskUpdate((item) => setTasks((all) => upsert(all, item)));
    return () => { offDownload(); offTask(); };
  }, []);

  async function detect() {
    setDetecting(true); const response = await window.h3.inspectEnvironment(); setDetecting(false);
    if (response.data) { setReport(response.data); setNotice({ text: `检测完成：${response.data.verdict}` }); } else showError(response.message);
  }
  if (!settings) return <div className="splash"><div className="brand-mark">H3</div><p>正在启动工作台…</p></div>;
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">H3</div><div><strong>MiniMax H3</strong><span>视频生成工作台</span></div></div>
      <nav>{pages.map((item) => <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}><i>{item.icon}</i>{item.label}</button>)}</nav>
      <div className="sidebar-foot"><span className="status-dot" /> 桌面版 0.1.0</div></aside>
    <main className="main-area">
      {page === "ready" && <ReadyPage report={report} busy={detecting} onDetect={detect} onNavigate={setPage} />}
      {page === "studio" && <StudioPage settings={settings} tasks={tasks} onError={showError} onNotice={(text) => setNotice({ text })} />}
      {page === "downloads" && <DownloadsPage settings={settings} setSettings={setSettings} manifest={manifest} progress={downloads} onError={showError} />}
      {page === "guide" && <GuidePage />}
      {page === "connections" && <ConnectionsPage settings={settings} setSettings={setSettings} onError={showError} onNotice={(text) => setNotice({ text })} />}
    </main>
    {notice && <button className={`toast ${notice.error ? "error" : ""}`} onClick={() => setNotice(undefined)}>{notice.text}<span>×</span></button>}
  </div>;
}

function ReadyPage({ report, busy, onDetect, onNavigate }: { report?: EnvironmentReport; busy: boolean; onDetect: () => void; onNavigate: (page: Page) => void }) {
  const gb = (value?: number) => value ? `${(value / 1024 ** 3).toFixed(1)} GB` : "未检测";
  const cards = [
    { name: "显卡", value: report?.gpus.map((g) => g.model).join(" / ") || "等待检测", sub: report?.gpus.map((g) => gb(g.vramBytes)).join(" / ") || "GPU 与显存" },
    { name: "内存", value: gb(report?.memoryTotalBytes), sub: report ? `可用 ${gb(report.memoryAvailableBytes)}` : "系统 RAM" },
    { name: "磁盘", value: gb(report?.diskFreeBytes), sub: "模型与输出可用空间" },
    { name: "ComfyUI", value: report?.comfyReachable ? `已连接 ${report.comfyVersion || ""}` : report ? "未连接" : "等待检测", sub: report?.comfyHasH3Nodes ? "H3 节点已就绪" : "检测版本与节点" }
  ];
  return <section className="page ready-page"><header className="hero"><span className="eyebrow">SYSTEM READINESS</span><h1>先判断怎么跑，<br/><em>再开始生成。</em></h1><p>一次检查本机硬件、存储、FFmpeg 和 ComfyUI，给出本地、SSH 或云 API 的明确建议。</p><button className="primary large" onClick={onDetect} disabled={busy}>{busy ? "正在检测…" : "开始配置检测"}</button></header>
    <div className="readiness-grid">{cards.map((card) => <article className="metric-card" key={card.name}><span>{card.name}</span><strong>{card.value}</strong><small>{card.sub}</small></article>)}</div>
    {report && <div className={`verdict grade-${report.grade.toLowerCase()}`}><div className="grade">{report.grade}</div><div><span>推荐路径</span><h2>{report.verdict}</h2><ul>{report.recommendations.map((x) => <li key={x}>{x}</li>)}</ul></div></div>}
    <div className="quick-actions"><button onClick={() => onNavigate("downloads")}><span>01</span><strong>下载模型</strong><small>断点续传与目录安装</small></button><button onClick={() => onNavigate("connections")}><span>02</span><strong>配置连接</strong><small>本地 / 云 API / SSH</small></button><button onClick={() => onNavigate("studio")}><span>03</span><strong>开始生成</strong><small>四路结果并行管理</small></button></div>
  </section>;
}

function StudioPage({ settings, tasks, onError, onNotice }: { settings: AppSettings; tasks: GenerationTask[]; onError: (e: unknown) => void; onNotice: (s: string) => void }) {
  const [request, setRequest] = useState<GenerationRequest>({ ...initialRequest, backend: settings.defaultBackend });
  const [submitting, setSubmitting] = useState(false);
  const currentTasks = useMemo(() => { const parent = tasks[0]?.parentId; const group = parent ? tasks.filter((task) => task.parentId === parent) : []; return Array.from({ length: 4 }, (_, i) => group.find((task) => task.index === i)); }, [tasks]);
  async function choose(kind: "image" | "video", field: keyof GenerationRequest) { const response = await window.h3.selectFile(kind); if (response.data) setRequest((r) => ({ ...r, [field]: response.data })); }
  async function submit() { setSubmitting(true); const response = await window.h3.submitGeneration(request); setSubmitting(false); if (!response.ok) onError(response.message); else onNotice("已创建 4 个生成任务"); }
  return <section className="page studio-page"><div className="page-title"><div><span className="eyebrow">CREATE</span><h1>生成工作台</h1></div><div className="backend-pill"><span />{backendLabel(request.backend)}</div></div>
    <div className="studio-layout"><div className="control-panel"><div className="mode-tabs">{(["text", "image", "video"] as GenerationMode[]).map((mode) => <button key={mode} className={request.mode === mode ? "active" : ""} onClick={() => setRequest({ ...request, mode })}>{mode === "text" ? "文生视频" : mode === "image" ? "图生视频" : "视频生视频"}</button>)}</div>
      <label>视频描述<textarea rows={7} value={request.prompt} onChange={(e) => setRequest({ ...request, prompt: e.target.value })} placeholder="描述主体、动作、镜头、光线与风格…"/><small>{request.prompt.length} / 2000</small></label>
      {request.mode === "text" && <div className="frame-row"><FilePicker label="首帧（可选）" path={request.firstFramePath} onClick={() => choose("image", "firstFramePath")} /><FilePicker label="尾帧（可选）" path={request.lastFramePath} onClick={() => choose("image", "lastFramePath")} /></div>}
      {request.mode === "image" && <FilePicker label="参考图片" path={request.sourceImagePath} onClick={() => choose("image", "sourceImagePath")} />}{request.mode === "video" && <FilePicker label="参考视频" path={request.sourceVideoPath} onClick={() => choose("video", "sourceVideoPath")} />}
      <div className="form-grid"><label>生成后端<select value={request.backend} onChange={(e) => setRequest({ ...request, backend: e.target.value as BackendKind })}><option value="local">本机 ComfyUI</option><option value="ssh">SSH 远程显卡</option><option value="minimax">MiniMax 云 API</option></select></label><label>时长<select value={request.duration} onChange={(e) => setRequest({ ...request, duration: Number(e.target.value) })}>{[4,6,8,10,12,15].map((x) => <option key={x} value={x}>{x} 秒</option>)}</select></label><label>画幅<select value={request.ratio} onChange={(e) => setRequest({ ...request, ratio: e.target.value as GenerationRequest["ratio"] })}>{["16:9","9:16","1:1","4:3","3:4","21:9","adaptive"].map((x) => <option key={x}>{x}</option>)}</select></label><label>分辨率<select value={request.resolution} onChange={(e) => setRequest({ ...request, resolution: e.target.value as "768P" | "2K" })}><option>768P</option><option>2K</option></select></label></div>
      <label>基础随机种子<input type="number" value={request.baseSeed} onChange={(e) => setRequest({ ...request, baseSeed: Number(e.target.value) })}/></label>
      <div className="submit-area"><div>{request.backend === "minimax" ? <><span>云端估算</span><strong>约 ${estimateCloudCost(request.resolution, request.duration, 4).toFixed(2)} / 4 条</strong></> : <><span>本地生成</span><strong>不产生 API 费用</strong></>}</div><button className="primary" disabled={submitting} onClick={submit}>{submitting ? "提交中…" : "生成 4 个结果"}</button></div>
    </div><div className="result-grid">{currentTasks.map((task, index) => <TaskCard key={task?.id || index} task={task} index={index} />)}</div></div>
  </section>;
}

function TaskCard({ task, index }: { task?: GenerationTask; index: number }) {
  const canCancel = task && !["succeeded","failed","cancelled","interrupted"].includes(task.status);
  const media = task?.outputPath ? `h3media://local/file?path=${encodeURIComponent(task.outputPath)}` : "";
  return <article className={`task-card ${task?.status || "empty"}`}>{media ? <video src={media} controls preload="metadata" /> : <div className="task-placeholder"><span>0{index + 1}</span><i>{task ? statusLabel(task.status) : "等待生成"}</i></div>}<div className="task-meta"><div><strong>{task ? `Seed ${task.seed}` : `结果 ${index + 1}`}</strong><small>{task?.message || "提交后显示生成进度"}</small></div>{task && <em>{task.progress}%</em>}</div>{task && <div className="progress"><i style={{ width: `${task.progress}%` }}/></div>}{task?.outputPath && <button className="text-button" onClick={() => window.h3.showItem(task.outputPath!)}>在文件夹中显示</button>}{canCancel && <button className="cancel-button" onClick={() => window.h3.cancelTask(task.id)}>取消</button>}</article>;
}

function DownloadsPage({ settings, setSettings, manifest, progress, onError }: { settings: AppSettings; setSettings: (s: AppSettings) => void; manifest: DownloadItem[]; progress: DownloadProgress[]; onError: (e: unknown) => void }) {
  const [accepted, setAccepted] = useState(false);
  async function pickPath() { const result = await window.h3.selectDirectory(); if (result.data) { const saved = await window.h3.updateSettings({ comfyPath: result.data }); if (saved.data) setSettings(saved.data); } }
  async function download(id: string) { const response = await window.h3.startDownload(id, settings.comfyPath, accepted); if (!response.ok) onError(response.message); }
  return <section className="page"><div className="page-title"><div><span className="eyebrow">INSTALL</span><h1>模型与工作流下载</h1></div></div><div className="path-bar"><div><span>ComfyUI 安装目录</span><strong>{settings.comfyPath || "尚未选择"}</strong></div><button onClick={pickPath}>选择目录</button></div><label className="license-check"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}/><span>我已阅读并同意 <button onClick={() => window.h3.openExternal("https://huggingface.co/Comfy-Org/MiniMax-H3_ComfyUI")}>MiniMax H3 Community License</button>。模型权重不随本软件分发。</span></label>
    <div className="download-list">{manifest.map((item) => { const state = progress.find((p) => p.id === item.id); const percent = state?.totalBytes ? Math.round(state.downloadedBytes / state.totalBytes * 100) : 0; return <article key={item.id}><div className="download-icon">{item.package === "workflow" ? "JSON" : "H3"}</div><div className="download-info"><span>{item.package === "base" ? "基础模型" : item.package === "reference" ? "参考模型" : "官方工作流"}</span><strong>{item.label}</strong><small>{item.relativePath}</small>{state && state.status !== "idle" && <div className="download-progress"><i style={{width: `${percent}%`}}/><em>{state.status === "completed" ? "完成" : `${percent}%`}</em></div>}</div><button className="secondary" disabled={!accepted || state?.status === "downloading"} onClick={() => download(item.id)}>{state?.status === "completed" ? "重新下载" : state?.status === "downloading" ? "下载中" : "下载"}</button></article>; })}</div><p className="footnote">下载支持断点续传，未完成文件以 .part 保存。超大模型建议保留至少 45 GB 可用空间。</p>
  </section>;
}

function GuidePage() { const guides = [
  ["准备 ComfyUI", <>安装或更新到包含 MiniMax H3 原生节点的版本，启动时加入 <code>--listen 127.0.0.1 --port 8188</code>。不要把端口直接暴露到公网。</>],
  ["安装模型", <>在“模型下载”页选择 ComfyUI 根目录。基础模型用于文生/图生，Reference 模型用于视频参考，工作流放入 <code>user/default/workflows</code>。</>],
  ["本机连接", <>默认地址为 <code>http://127.0.0.1:8188</code>。先启动 ComfyUI，再测试连接；工作台会检查 H3 节点。</>],
  ["租用显卡 / SSH", <>远端 ComfyUI 监听回环地址。填写主机、账号和私钥；确认并记录 SHA-256 主机指纹。</>],
  ["MiniMax 云 API", <>从 MiniMax 开放平台创建 API Key。密钥只保存在操作系统安全存储中；提交前会显示费用估算。</>],
  ["首尾帧控制", <>文生视频可用提示词、首帧或首尾帧；图生视频需要参考图；视频生视频需要参考视频。</>]
  ]; return <section className="page guide"><div className="page-title"><div><span className="eyebrow">HANDBOOK</span><h1>配置指南</h1></div></div><div className="guide-grid">{guides.map(([title, body], i) => <article key={String(title)}><span>0{i+1}</span><h2>{title}</h2><p>{body}</p></article>)}</div><div className="callout"><strong>遇到 OOM？</strong><span>降低分辨率或时长，关闭其他占显存程序；单卡不足时优先使用 SSH 多卡主机或 MiniMax 云 API。</span></div></section>; }

function ConnectionsPage({ settings, setSettings, onError, onNotice }: { settings: AppSettings; setSettings: (s: AppSettings) => void; onError: (e: unknown) => void; onNotice: (s: string) => void }) {
  const [draft, setDraft] = useState(settings); const [apiKey, setApiKey] = useState(""); const [sshPassword, setSshPassword] = useState(""); const [testing, setTesting] = useState<BackendKind>(); const [results, setResults] = useState<Partial<Record<BackendKind, BackendTestResult>>>({});
  const setSsh = (patch: Partial<AppSettings["ssh"]>) => setDraft({ ...draft, ssh: { ...draft.ssh, ...patch } });
  async function save() { try { const saved = await must(window.h3.updateSettings(draft)); if (apiKey) await must(window.h3.setSecret("minimaxApiKey", apiKey)); if (sshPassword) await must(window.h3.setSecret("sshPassword", sshPassword)); setSettings(saved); setApiKey(""); setSshPassword(""); onNotice("连接设置已安全保存"); } catch (e) { onError(e); } }
  async function test(kind: BackendKind) { setTesting(kind); const result = await window.h3.testBackend(kind); setTesting(undefined); if (result.data) setResults((r) => ({...r,[kind]:result.data})); else onError(result.message); }
  return <section className="page connections"><div className="page-title"><div><span className="eyebrow">CONNECT</span><h1>连接设置</h1></div><button className="primary" onClick={save}>保存全部设置</button></div>
    <ConnectionCard title="本机 ComfyUI" badge="LOCAL" result={results.local} onTest={() => test("local")} testing={testing === "local"}><label>服务地址<input value={draft.localComfyUrl} onChange={(e) => setDraft({...draft,localComfyUrl:e.target.value})}/></label><label>输出目录<div className="input-button"><input value={draft.outputDirectory} onChange={(e) => setDraft({...draft,outputDirectory:e.target.value})}/><button onClick={async () => { const x=await window.h3.selectDirectory(); if(x.data)setDraft({...draft,outputDirectory:x.data}); }}>选择</button></div></label></ConnectionCard>
    <ConnectionCard title="MiniMax 云 API" badge="CLOUD" result={results.minimax} onTest={() => test("minimax")} testing={testing === "minimax"}><label>API 地址<input value={draft.minimaxBaseUrl} onChange={(e) => setDraft({...draft,minimaxBaseUrl:e.target.value})}/></label><label>API Key<input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="已保存的密钥不会回显；留空不修改"/></label></ConnectionCard>
    <ConnectionCard title="SSH 远程显卡" badge="REMOTE" result={results.ssh} onTest={() => test("ssh")} testing={testing === "ssh"}><div className="form-grid"><label>主机<input value={draft.ssh.host} onChange={(e)=>setSsh({host:e.target.value})} placeholder="gpu.example.com"/></label><label>端口<input type="number" value={draft.ssh.port} onChange={(e)=>setSsh({port:Number(e.target.value)})}/></label><label>用户名<input value={draft.ssh.username} onChange={(e)=>setSsh({username:e.target.value})}/></label><label>远端 ComfyUI 端口<input type="number" value={draft.ssh.remoteComfyPort} onChange={(e)=>setSsh({remoteComfyPort:Number(e.target.value)})}/></label></div><label>私钥路径<div className="input-button"><input value={draft.ssh.privateKeyPath} onChange={(e)=>setSsh({privateKeyPath:e.target.value})}/><button onClick={async()=>{const x=await window.h3.selectFile("key");if(x.data)setSsh({privateKeyPath:x.data});}}>选择</button></div></label><label>SSH 密码（仅无私钥时）<input type="password" value={sshPassword} onChange={(e)=>setSshPassword(e.target.value)} placeholder="使用系统安全存储"/></label><label>主机 SHA-256 指纹<input value={draft.ssh.hostFingerprint} onChange={(e)=>setSsh({hostFingerprint:e.target.value})} placeholder="首次测试确认后填入"/></label></ConnectionCard>
  </section>;
}

function ConnectionCard({ title, badge, result, onTest, testing, children }: { title: string; badge: string; result?: BackendTestResult; onTest: () => void; testing: boolean; children: ReactNode }) { return <article className="connection-card"><header><div><span>{badge}</span><h2>{title}</h2></div><button className="secondary" onClick={onTest} disabled={testing}>{testing ? "测试中…" : "测试连接"}</button></header><div className="connection-fields">{children}</div>{result && <div className={`test-result ${result.ok ? "ok" : "bad"}`}><strong>{result.ok ? "连接成功" : "连接失败"}</strong><span>{result.message} · {result.latencyMs}ms</span></div>}</article>; }
function FilePicker({ label, path, onClick }: { label: string; path?: string; onClick: () => void }) { return <button className={`file-picker ${path ? "picked" : ""}`} onClick={onClick}><span>{path ? "✓" : "+"}</span><strong>{label}</strong><small>{path ? path.split(/[\\/]/).pop() : "点击选择文件"}</small></button>; }
function upsert<T extends { id: string }>(items: T[], item: T): T[] { const index=items.findIndex((x)=>x.id===item.id); if(index<0)return[item,...items];const copy=[...items];copy[index]=item;return copy; }
async function must<T>(promise: Promise<ApiResponse<T>>): Promise<T> { const result=await promise;if(!result.ok)throw new Error(result.message||"操作失败");return result.data as T; }
function backendLabel(kind: BackendKind) { return kind === "local" ? "本机 ComfyUI" : kind === "ssh" ? "SSH 远程显卡" : "MiniMax 云 API"; }
function statusLabel(status: GenerationTask["status"]) { return ({draft:"草稿",validating:"校验中",uploading:"上传中",queued:"排队中",running:"生成中",decoding:"解码中",downloading:"保存中",succeeded:"已完成",failed:"失败",cancelled:"已取消",interrupted:"已中断"} as const)[status]; }
