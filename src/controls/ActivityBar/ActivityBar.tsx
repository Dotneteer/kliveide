import styles from "./ActivityBar.module.scss";

type Props = {
    order?: number
}

export const ActivityBar = ({order}: Props) => {
    return <div className={styles.component} style={{order}}>
        AB
    </div>
}