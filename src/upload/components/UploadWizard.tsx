"use client";

import { useUploadWizard } from "../hooks/useUploadWizard";
import FileDropZone from "./FileDropZone";
import UploadEntryCards from "./UploadEntryCards";
import UploadStatusView from "./UploadStatusView";
import ZipConversionList from "./ZipConversionList";

export default function UploadWizard({ directUploadEnabled }: { directUploadEnabled: boolean }) {
  const {
    step,
    files,
    fileStates,
    zipConversions,
    isAnyConverting,
    updateEntry,
    handleAdd,
    handleRemoveZipChip,
    handleRemoveFile,
    handleContinue,
    handleBack,
    handleSubmit,
  } = useUploadWizard(directUploadEnabled);

  if (step === 1) {
    return (
      <div className="flex flex-col gap-4">
        <FileDropZone
          files={files}
          onAdd={handleAdd}
          onRemove={handleRemoveFile}
        />
        <ZipConversionList
          conversions={zipConversions}
          onRemove={handleRemoveZipChip}
        />
        <button
          type="button"
          onClick={handleContinue}
          disabled={files.length === 0 || isAnyConverting}
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
