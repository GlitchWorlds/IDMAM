import { memo } from 'react';
import { pauseDownload, resumeDownload, cancelDownload, deleteDownload, openFolder, formatBytes as formatSize, formatSpeed, formatETA as formatEta } from '../api';

function getStatusColor(status) {
  switch (status) {
    case 'downloading':
    case 'active': return 'text-accent';
    case 'completed': return 'text-emerald-400';
    case 'paused': return 'text-amber-400';
    case 'error': return 'text-red-400';
    default: return 'text-slate-400';
  }
}

function getStatusBadge(status) {
  const colors = {
    downloading: 'bg-accent/20 text-accent',
    active: 'bg-accent/20 text-accent',
    completed: 'bg-emerald-500/20 text-emerald-400',
    paused: 'bg-amber-500/20 text-amber-400',
    queued: 'bg-slate-500/20 text-slate-400',
    waiting: 'bg-slate-500/20 text-slate-400',
    error: 'bg-red-500/20 text-red-400',
  };
  return colors[status] || 'bg-slate-500/20 text-slate-400';
}

function DownloadItem({ download, onRefresh }) {
  const { id, filename, url, status, progress, speed, total_size, downloaded, eta, save_to } = download;
  const pct = progress || 0;
  const isActive = status === 'downloading' || status === 'active';
  const isPaused = status === 'paused';
  const isCompleted = status === 'completed';
  const isError = status === 'error';

  const handlePause = async () => {
    try { await pauseDownload(id); onRefresh?.(); } catch (e) { console.error(e); }
  };
  const handleResume = async () => {
    try { await resumeDownload(id); onRefresh?.(); } catch (e) { console.error(e); }
  };
  const handleCancel = async () => {
    try { await cancelDownload(id); onRefresh?.(); } catch (e) { console.error(e); }
  };
  const handleDelete = async () => {
    try { await deleteDownload(id); onRefresh?.(); } catch (e) { console.error(e); }
  };

  return (
    <div className="card-hover bg-slate-800/50 rounded-xl p-4 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Filename & Status */}
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-sm font-medium text-slate-100 truncate flex-1">
              {filename || url || 'Unknown file'}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(status)}`}>
              {status || 'unknown'}
            </span>
          </div>

          {/* URL */}
          <p className="text-xs text-slate-500 truncate mb-3">{url}</p>

          {/* Progress Bar */}
          <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
            <div
              className="progress-bar absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className={getStatusColor(status)}>
              {pct.toFixed(1)}%
            </span>
            {downloaded != null && total_size != null && (
              <span>{formatSize(downloaded)} / {formatSize(total_size)}</span>
            )}
            {isActive && speed > 0 && (
              <span className="text-accent">{formatSpeed(speed)}</span>
            )}
            {isActive && <span>ETA: {formatEta(eta)}</span>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {isActive && (
            <button onClick={handlePause} className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-700 transition-colors" title="Pause">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
              </svg>
            </button>
          )}
          {isPaused && (
            <button onClick={handleResume} className="p-2 rounded-lg text-slate-400 hover:text-accent hover:bg-slate-700 transition-colors" title="Resume">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
              </svg>
            </button>
          )}
          {(isActive || isPaused || isError) && (
            <button onClick={handleCancel} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors" title="Cancel">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {isCompleted && (
            <>
              <button onClick={() => openFolder(save_to)} className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition-colors" title="Open Folder">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </button>
              <button onClick={handleDelete} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors" title="Delete">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DownloadList({ downloads, onRefresh }) {
  if (!downloads || downloads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <svg className="w-16 h-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">No downloads</p>
        <p className="text-xs text-slate-600 mt-1">Add a URL to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {downloads.map((d) => (
        <DownloadItem key={d.id} download={d} onRefresh={onRefresh} />
      ))}
    </div>
  );
}

export default memo(DownloadList);
