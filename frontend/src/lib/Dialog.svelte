<script>
  import { dialog } from './stores/dialog.js';
  import { fade, scale } from 'svelte/transition';

  let inputElement;

  $: if ($dialog.isOpen && $dialog.type === 'prompt' && inputElement) {
    setTimeout(() => inputElement?.focus(), 50);
  }

  function handleConfirm() {
    if ($dialog.type === 'alert') {
      dialog.close();
    } else if ($dialog.type === 'confirm') {
      dialog.close(true);
    } else if ($dialog.type === 'prompt') {
      dialog.close($dialog.inputValue);
    }
  }

  function handleCancel() {
    if ($dialog.type === 'alert') {
      dialog.close();
    } else if ($dialog.type === 'confirm') {
      dialog.close(false);
    } else if ($dialog.type === 'prompt') {
      dialog.close(null);
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }

  function handleInputKeydown(e) {
    if (e.key === 'Enter') {
      handleConfirm();
    }
  }
</script>

<svelte:window on:keydown={$dialog.isOpen ? handleKeydown : null} />

{#if $dialog.isOpen}
  <div class="dialog-overlay" transition:fade={{ duration: 150 }} on:click={handleCancel}>
    <div
      class="dialog"
      class:danger={$dialog.variant === 'danger'}
      class:warning={$dialog.variant === 'warning'}
      class:success={$dialog.variant === 'success'}
      transition:scale={{ duration: 150, start: 0.95 }}
      on:click|stopPropagation
    >
      <div class="dialog-header">
        <div class="dialog-icon">
          {#if $dialog.variant === 'danger'}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          {:else if $dialog.variant === 'warning'}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          {:else if $dialog.variant === 'success'}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          {:else if $dialog.type === 'confirm'}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          {:else}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          {/if}
        </div>
        <h3 class="dialog-title">{$dialog.title}</h3>
      </div>

      <div class="dialog-body">
        <p class="dialog-message">{$dialog.message}</p>

        {#if $dialog.type === 'prompt'}
          <input
            bind:this={inputElement}
            type="text"
            class="dialog-input"
            bind:value={$dialog.inputValue}
            placeholder={$dialog.inputPlaceholder}
            on:keydown={handleInputKeydown}
          />
        {/if}
      </div>

      <div class="dialog-footer">
        {#if $dialog.type !== 'alert'}
          <button class="btn btn-secondary" on:click={handleCancel}>
            {$dialog.cancelText}
          </button>
        {/if}
        <button
          class="btn btn-primary"
          class:btn-danger={$dialog.variant === 'danger'}
          class:btn-warning={$dialog.variant === 'warning'}
          class:btn-success={$dialog.variant === 'success'}
          on:click={handleConfirm}
        >
          {$dialog.confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
  }

  .dialog {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    width: 100%;
    max-width: 400px;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  }

  .dialog.danger .dialog-icon {
    color: var(--danger-color);
  }

  .dialog.warning .dialog-icon {
    color: var(--warning-color);
  }

  .dialog.success .dialog-icon {
    color: var(--success-color);
  }

  .dialog-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 20px 0;
  }

  .dialog-icon {
    width: 40px;
    height: 40px;
    background: var(--bg-tertiary);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-color);
    flex-shrink: 0;
  }

  .dialog-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    color: var(--text-primary);
  }

  .dialog-body {
    padding: 16px 20px 20px;
  }

  .dialog-message {
    margin: 0;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .dialog-input {
    width: 100%;
    margin-top: 16px;
    padding: 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 14px;
  }

  .dialog-input:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 20px 20px;
  }

  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-secondary:hover {
    background: var(--bg-hover);
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
  }

  .btn-primary:hover {
    background: var(--accent-hover);
  }

  .btn-danger {
    background: var(--danger-color);
  }

  .btn-danger:hover {
    background: #dc2626;
  }

  .btn-warning {
    background: var(--warning-color);
  }

  .btn-warning:hover {
    background: #d97706;
  }

  .btn-success {
    background: var(--success-color);
  }

  .btn-success:hover {
    background: #059669;
  }
</style>
