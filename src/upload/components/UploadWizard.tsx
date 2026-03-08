"use client";

import { useUploadWizard } from "../hooks/useUploadWizard";
import FileDropZone from "./FileDropZone";
import UploadEntryCards from "./UploadEntryCards";
import UploadStatusView from "./UploadStatusView";

export default function UploadWizard() {
  const {
    step,
    files,
    fileStates,
    updateEntry,
    handleAddFiles,
    handleRemoveFile,
    handleContinue,
    handleBack,
    handleSubmit,
  } = useUploadWizard();

  if (step === 1) {
    return (
      <div className="flex flex-col gap-4">
        <FileDropZone files={files} onAdd={handleAddFiles} onRemove={handleRemoveFile} />
        <button
          type="button"
          onClick={handleContinue}
          disabled={files.length === 0}
          className="btn-primary"
        >
          Продовжити
        </button>
      </div>
    );
  }

  if (step === 3) {
    return <UploadStatusView fileStates={fileStates} />;
  }

  return (
    <UploadEntryCards
      fileStates={fileStates}
      updateEntry={updateEntry}
      handleBack={handleBack}
      handleSubmit={handleSubmit}
    />
  );
}
