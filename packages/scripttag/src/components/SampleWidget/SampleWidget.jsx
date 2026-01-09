/**
 * Sample Widget Component
 *
 * A simple Preact component that renders in the storefront.
 * Use this as a starting point for building your own widgets.
 *
 * Features demonstrated:
 * - Preact functional component with hooks
 * - CSS Modules for scoped styling
 * - Props handling
 * - Event handling
 * - Conditional rendering
 */

import {useState, useCallback} from 'preact/hooks';
import styles from './SampleWidget.module.scss';

/**
 * Sample Widget Component
 *
 * @param {Object} props
 * @param {Object} props.data - Widget data from API or window
 */
export function SampleWidget({data}) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const {settings = {}, content = {}} = data;

  const handleClose = useCallback(() => {
    setIsVisible(false);
  }, []);

  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`${styles.widget} ${isExpanded ? styles.expanded : ''}`}
      style={{
        '--widget-bg': settings.backgroundColor || '#ffffff',
        '--widget-text': settings.textColor || '#333333',
        '--widget-accent': settings.accentColor || '#008060'
      }}
    >
      <div className={styles.header}>
        <span className={styles.title}>{content.title || 'Sample Widget'}</span>
        <div className={styles.actions}>
          <button className={styles.toggleBtn} onClick={handleToggle} aria-label="Toggle details">
            {isExpanded ? '−' : '+'}
          </button>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">
            ×
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className={styles.content}>
          <p className={styles.message}>{content.message || 'This is a sample widget message.'}</p>
          {content.ctaText && (
            <a href={content.ctaUrl || '#'} className={styles.cta}>
              {content.ctaText}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default SampleWidget;
