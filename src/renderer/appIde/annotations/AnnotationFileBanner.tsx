import styles from "./AnnotationFileBanner.module.scss";

/** What a viewer knows about its file's annotation sidecar. */
export type AnnotationFileStatus = "missing" | "loaded" | "invalid" | "error" | "loading";

/**
 * Whether the file has annotations: a create link when it has none, a short error when they cannot
 * be read, and nothing at all when they loaded — a file that is fine looks no different.
 */
export const AnnotationFileBanner = ({
  status,
  details,
  onCreate
}: {
  status: AnnotationFileStatus;
  details?: string;
  onCreate: () => void;
}) => {
  if (status === "missing") {
    return (
      <div className={styles.banner}>
        <span>No annotation file attached.</span>
        <button type="button" className={styles.link} onClick={onCreate}>
          Click to create one!
        </button>
      </div>
    );
  }
  if (status === "invalid" || status === "error") {
    return (
      <div className={styles.banner} title={details || undefined}>
        <span className={styles.error}>Annotation file could not be loaded.</span>
      </div>
    );
  }
  return null;
};
