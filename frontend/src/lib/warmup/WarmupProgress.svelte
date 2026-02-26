<script>
  import { createEventDispatcher } from 'svelte';

  export let warmup;

  const dispatch = createEventDispatcher();

  // Platform icons
  const platformIcons = {
    facebook: '\u{1F535}',
    tiktok: '\u{1F3B5}',
    instagram: '\u{1F4F7}',
    google: '\u{1F50D}',
    twitter: '\u{1F426}',
    youtube: '\u{1F4FA}',
    linkedin: '\u{1F4BC}',
    telegram: '\u{2708}'
  };

  // Action icons
  const icons = {
    pause: '\u{23F8}',
    play: '\u{25B6}',
    stop: '\u{23F9}',
    delete: '\u{1F5D1}',
    globe: '\u{1F310}',
    rocket: '\u{1F680}'
  };

  $: progress = warmup.currentDay / (warmup.totalDays || 21) * 100;
  $: statusClass = warmup.status;
  $: statusText = {
    pending: 'Pending',
    running: 'Running',
    paused: 'Paused',
    completed: 'Completed',
    failed: 'Failed'
  }[warmup.status] || warmup.status;

  $: nextRunFormatted = warmup.nextRunAt
    ? new Date(warmup.nextRunAt).toLocaleString('vi-VN')
    : '-';

  function handlePause() {
    dispatch('pause');
  }

  function handleResume() {
    dispatch('resume');
  }

  function handleStop() {
    dispatch('stop');
  }

  function handleDelete() {
    dispatch('delete');
  }

  function handleRunNow() {
    dispatch('runNow');
  }
</script>

<div class="warmup-progress" class:running={warmup.status === 'running'} class:paused={warmup.status === 'paused'} class:failed={warmup.status === 'failed'} class:completed={warmup.status === 'completed'}>
  <div class="progress-icon">
    {platformIcons[warmup.templatePlatform] || icons.globe}
  </div>

  <div class="progress-info">
    <div class="progress-header">
      <span class="profile-name">{warmup.profileName || warmup.profileId}</span>
      <span class="status-badge {statusClass}">{statusText}</span>
    </div>

    <div class="progress-template">
      {warmup.templateName || 'Unknown Template'}
    </div>

    <div class="progress-bar-container">
      <div class="progress-bar" style="width: {progress}%"></div>
    </div>

    <div class="progress-meta">
      <span class="day-info">Day {warmup.currentDay}/{warmup.totalDays || 21} (Phase {warmup.currentPhase})</span>
      <span class="next-run">Next: {nextRunFormatted}</span>
    </div>
  </div>

  <div class="progress-actions">
    {#if warmup.status === 'pending' || warmup.status === 'paused'}
      <button class="btn-action run" on:click={handleRunNow} title="Run Now">
        {icons.rocket}
      </button>
    {/if}

    {#if warmup.status === 'running' || warmup.status === 'pending'}
      <button class="btn-action pause" on:click={handlePause} title="Pause">
        {icons.pause}
      </button>
    {/if}

    {#if warmup.status === 'paused'}
      <button class="btn-action resume" on:click={handleResume} title="Resume">
        {icons.play}
      </button>
    {/if}

    {#if warmup.status !== 'completed' && warmup.status !== 'failed'}
      <button class="btn-action stop" on:click={handleStop} title="Stop">
        {icons.stop}
      </button>
    {/if}

    <button class="btn-action delete" on:click={handleDelete} title="Delete">
      {icons.delete}
    </button>
  </div>
</div>

<style>
  .warmup-progress {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: #0f3460;
    border: 1px solid #1a4a7a;
    border-radius: 8px;
    padding: 1rem;
    transition: border-color 0.2s;
  }

  .warmup-progress:hover {
    border-color: #2a5a8a;
  }

  .warmup-progress.running {
    border-left: 3px solid #3b82f6;
  }

  .warmup-progress.paused {
    border-left: 3px solid #f59e0b;
  }

  .warmup-progress.failed {
    border-left: 3px solid #ef4444;
  }

  .warmup-progress.completed {
    border-left: 3px solid #22c55e;
  }

  .progress-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .progress-info {
    flex: 1;
    min-width: 0;
  }

  .progress-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .profile-name {
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status-badge {
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .status-badge.running {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  .status-badge.pending {
    background: rgba(156, 163, 175, 0.2);
    color: #9ca3af;
  }

  .status-badge.paused {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
  }

  .status-badge.completed {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .status-badge.failed {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .progress-template {
    font-size: 0.8rem;
    color: #888;
    margin-bottom: 0.5rem;
  }

  .progress-bar-container {
    height: 6px;
    background: #16213e;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #e94560, #3b82f6);
    border-radius: 3px;
    transition: width 0.3s;
  }

  .progress-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #666;
  }

  .day-info {
    color: #888;
  }

  .next-run {
    color: #666;
  }

  .progress-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .btn-action {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0.25rem;
    opacity: 0.6;
    transition: opacity 0.2s, transform 0.2s;
  }

  .btn-action:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  .btn-action.run { color: #3b82f6; }
  .btn-action.pause { color: #f59e0b; }
  .btn-action.resume { color: #22c55e; }
  .btn-action.stop { color: #ef4444; }
  .btn-action.delete { color: #888; }

  .btn-action.delete:hover {
    color: #ef4444;
  }
</style>
