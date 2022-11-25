import styles from "./SiteBar.module.scss";

type Props = {
    order?: number
}

export const SiteBar = ({order}: Props) => {
    return <div className={styles.component} style={{order}}>
        Sitebar
    </div>
}