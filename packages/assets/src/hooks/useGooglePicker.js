import {useState, useCallback, useRef} from 'react';
import {isEmbeddedApp} from '../config/app';

const PICKER_SCRIPT_URL = 'https://apis.google.com/js/api.js';

export function useGooglePicker() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const gapiLoadedRef = useRef(false);

  const loadGapiScript = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (window.gapi && gapiLoadedRef.current) {
        resolve();
        return;
      }

      if (document.querySelector(`script[src="${PICKER_SCRIPT_URL}"]`)) {
        const checkInterval = setInterval(() => {
          if (window.gapi) {
            clearInterval(checkInterval);
            gapiLoadedRef.current = true;
            resolve();
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.src = PICKER_SCRIPT_URL;
      script.onload = () => {
        gapiLoadedRef.current = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Google API'));
      document.head.appendChild(script);
    });
  }, []);

  const openPicker = useCallback(
    async ({accessToken, appId, onSelect, onCancel}) => {
      try {
        setLoading(true);
        setError(null);

        await loadGapiScript();

        await new Promise((resolve, reject) => {
          window.gapi.load('picker', {callback: resolve, onerror: reject});
        });

        const view = new window.google.picker.DocsView();
        view.setMimeTypes(
          [
            'application/vnd.google-apps.spreadsheet',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv'
          ].join(',')
        );

        const builder = new window.google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(accessToken)
          .setOrigin(
            isEmbeddedApp
              ? 'https://admin.shopify.com'
              : window.location.protocol + '//' + window.location.host
          )
          .setCallback(data => {
            if (data.action === window.google.picker.Action.PICKED) {
              const doc = data.docs[0];
              onSelect({
                spreadsheetId: doc.id,
                name: doc.name,
                url: doc.url
              });
            } else if (data.action === window.google.picker.Action.CANCEL) {
              if (onCancel) onCancel();
            }
          })
          .setTitle('Select a Google Spreadsheet');

        if (appId) {
          builder.setAppId(appId);
        }

        const picker = builder.build();
        picker.setVisible(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [loadGapiScript]
  );

  return {openPicker, loading, error};
}
