import { writable } from 'svelte/store';

// Dialog state
const createDialogStore = () => {
  const { subscribe, set, update } = writable({
    isOpen: false,
    type: 'alert', // 'alert' | 'confirm' | 'prompt'
    title: '',
    message: '',
    confirmText: 'OK',
    cancelText: 'Cancel',
    variant: 'default', // 'default' | 'danger' | 'warning' | 'success'
    inputValue: '',
    inputPlaceholder: '',
    resolve: null
  });

  return {
    subscribe,

    /**
     * Show alert dialog
     * @param {string} message - Message to display
     * @param {Object} options - Optional config
     * @returns {Promise<void>}
     */
    alert: (message, options = {}) => {
      return new Promise((resolve) => {
        set({
          isOpen: true,
          type: 'alert',
          title: options.title || 'Alert',
          message,
          confirmText: options.confirmText || 'OK',
          cancelText: 'Cancel',
          variant: options.variant || 'default',
          inputValue: '',
          inputPlaceholder: '',
          resolve
        });
      });
    },

    /**
     * Show confirm dialog
     * @param {string} message - Message to display
     * @param {Object} options - Optional config
     * @returns {Promise<boolean>}
     */
    confirm: (message, options = {}) => {
      return new Promise((resolve) => {
        set({
          isOpen: true,
          type: 'confirm',
          title: options.title || 'Confirm',
          message,
          confirmText: options.confirmText || 'Confirm',
          cancelText: options.cancelText || 'Cancel',
          variant: options.variant || 'default',
          inputValue: '',
          inputPlaceholder: '',
          resolve
        });
      });
    },

    /**
     * Show prompt dialog
     * @param {string} message - Message to display
     * @param {Object} options - Optional config
     * @returns {Promise<string|null>}
     */
    prompt: (message, options = {}) => {
      return new Promise((resolve) => {
        set({
          isOpen: true,
          type: 'prompt',
          title: options.title || 'Input',
          message,
          confirmText: options.confirmText || 'OK',
          cancelText: options.cancelText || 'Cancel',
          variant: options.variant || 'default',
          inputValue: options.defaultValue || '',
          inputPlaceholder: options.placeholder || '',
          resolve
        });
      });
    },

    /**
     * Close dialog and resolve
     */
    close: (result) => {
      update(state => {
        if (state.resolve) {
          state.resolve(result);
        }
        return {
          ...state,
          isOpen: false,
          resolve: null
        };
      });
    },

    /**
     * Update input value (for prompt)
     */
    setInputValue: (value) => {
      update(state => ({ ...state, inputValue: value }));
    }
  };
};

export const dialog = createDialogStore();

// Convenience exports
export const showAlert = (message, options) => dialog.alert(message, options);
export const showConfirm = (message, options) => dialog.confirm(message, options);
export const showPrompt = (message, options) => dialog.prompt(message, options);
