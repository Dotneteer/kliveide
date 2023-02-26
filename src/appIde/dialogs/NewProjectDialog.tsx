import styles from "./NewProjectDialog.module.scss";
import { ModalApi, Modal } from "@/controls/Modal";
import { TextInput } from "@/controls/TextInput";
import { useRef, useState } from "react";
import { IconButton } from "@/controls/IconButton";
import { Dropdown } from "@/controls/Dropdown";

const VALID_FILENAME = /^[^>:"/\\|?*]+$/;

const machineIds = [
  {
    value: "sp48",
    label: "ZX Spectrum 48K"
  },
  {
    value: "sp128",
    label: "ZX Spectrum 128K"
  }
];

type Props = {
  onClose: () => void;
  onCreate: (
    machineId: string,
    projectName: string,
    folder?: string
  ) => Promise<void>;
};

export const NewProjectDialog = ({ onClose, onCreate }: Props) => {
  const modalApi = useRef<ModalApi>(null);
  const [projectFolder, setProjectFolder] = useState("");
  const [projectName, setProjectName] = useState("");

  const validate = (fn: string) => VALID_FILENAME.test(fn);
  const folderIsValid = projectFolder.trim() === "" || validate(projectFolder);
  const projectIsValid = projectName.trim() !== "" && validate(projectName);

  return (
    <Modal
      title='Create a new Klive project'
      isOpen={true}
      fullScreen={false}
      width={500}
      onApiLoaded={api => (modalApi.current = api)}
      primaryLabel='Create'
      primaryEnabled={folderIsValid && projectIsValid}
      initialFocus='none'
      onPrimaryClicked={async result => {
        // TODO: Create
        return false;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <div>Machine type: *</div>
      <div className={styles.dropdownWrapper}>
        <Dropdown
          placeholder='Select...'
          options={machineIds}
          value={"sp48"}
          onSelectionChanged={option => {}}
        />
      </div>
      <div>Project folder:</div>
      <div className={styles.inputRow}>
        <div className={styles.fullWidth}>
          <TextInput
            value={""}
            isValid={folderIsValid}
            focusOnInit={true}
            valueChanged={val => {
              setProjectFolder(val);
              modalApi.current.enablePrimaryButton(
                val.trim() === "" || validate(val) && projectIsValid
              );
              return false;
            }}
          />
        </div>
        <div className={styles.iconWrapper}>
          <IconButton
            iconName='folder'
            iconSize={24}
            title='Select project folder'
            fill="--color-command-icon"
          />
        </div>
      </div>
      <div>Project name: *</div>
      <TextInput
        value={""}
        isValid={projectIsValid}
        focusOnInit={true}
        valueChanged={val => {
          setProjectName(val);
          modalApi.current.enablePrimaryButton(
            (val.trim() !== "" || validate(val)) && folderIsValid
          );
          return false;
        }}
      />
    </Modal>
  );
};
