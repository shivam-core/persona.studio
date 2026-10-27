"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/formatters";
import {
  Database,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Play,
  Trash2,
  Check,
  ExternalLink,
  Table as TableIcon,
  Sparkles,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import {
  NotionEmptyStateIllustration,
  NotionGirlCreator,
} from "@/components/illustrations/NotionIllustrations";

export default function DataHubPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [asOfDate, setAsOfDate] = useState("2026-10-13");
  const [lookbackDays, setLookbackDays] = useState(180);
  const [selectedTable, setSelectedTable] = useState("customers");
  const [isBuildingFeatures, setIsBuildingFeatures] = useState(false);
  const [isLoadingReal, setIsLoadingReal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [activeTab, setActiveTab] = useState<"snapshot" | "wizard" | "quarantine">("snapshot");

  // Wizard draft state
  const [newDatasetName, setNewDatasetName] = useState("Store Data Ingestion");
  const [draftDatasetId, setDraftDatasetId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [uploadedFilesList, setUploadedFilesList] = useState<
    Array<{ table: string; filename: string; rows: number }>
  >([]);

  const { data: workspace } = useQuery({
    queryKey: ["workspace"],
    queryFn: api.getWorkspace,
  });

  const { data: datasets } = useQuery({
    queryKey: ["datasets"],
    queryFn: api.getDatasets,
  });

  const activeDataset = datasets?.[0];
  const hasData = Boolean(
    activeDataset &&
      (activeDataset.accepted_rows > 0 ||
        (activeDataset.row_counts?.customers ?? 0) > 0)
  );

  const { data: validationData } = useQuery({
    queryKey: ["validation", activeDataset?.id],
    queryFn: () => (activeDataset ? api.getDatasetValidation(activeDataset.id) : null),
    enabled: !!activeDataset?.id,
  });

  const handleLoadRealData = async () => {
    try {
      setIsLoadingReal(true);
      await api.importRealBundle();
      await queryClient.invalidateQueries();
      alert("Successfully loaded real retail dataset (2,000 customers, 18,301 orders)!");
    } catch (err: any) {
      alert("Error loading real dataset: " + err.message);
    } finally {
      setIsLoadingReal(false);
    }
  };

  const handleResetWorkspace = async () => {
    if (confirm("Are you sure you want to reset the workspace data?")) {
      try {
        setIsResetting(true);
        await api.resetWorkspace();
        setDraftDatasetId(null);
        setUploadedFilesList([]);
        await queryClient.invalidateQueries();
        alert("Workspace reset successfully.");
      } catch (err: any) {
        alert("Failed to reset: " + err.message);
      } finally {
        setIsResetting(false);
      }
    }
  };

  const handleBuildFeatures = async () => {
    if (!activeDataset) return;
    try {
      setIsBuildingFeatures(true);
      await api.buildFeatures(activeDataset.id, `${asOfDate}T00:00:00Z`, lookbackDays);
      await queryClient.invalidateQueries();
      alert("Customer purchasing profiles recalculated successfully!");
    } catch (err: any) {
      alert("Failed to update customer records: " + err.message);
    } finally {
      setIsBuildingFeatures(false);
    }
  };

  const handleCreateDraft = async () => {
    try {
      const draft = await api.createDataset(newDatasetName || "Custom CSV Ingestion");
      setDraftDatasetId(draft.id);
      alert(`Created ingestion draft: "${draft.name}". You can now upload CSV files!`);
    } catch (err: any) {
      alert("Failed to create dataset draft: " + err.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadErrorMessage(null);
    setUploadSuccessMessage(null);

    let targetDatasetId = draftDatasetId;
    if (!targetDatasetId) {
      try {
        const draft = await api.createDataset(newDatasetName || "Custom CSV Ingestion");
        targetDatasetId = draft.id;
        setDraftDatasetId(draft.id);
      } catch (err: any) {
        setUploadErrorMessage("Failed to initialize dataset: " + err.message);
        return;
      }
    }

    try {
      setIsUploading(true);
      const res = await api.uploadDatasetFile(targetDatasetId, selectedTable, file);
      setUploadSuccessMessage(`Uploaded "${file.name}" for ${selectedTable} (${res.row_count.toLocaleString()} rows).`);
      setUploadedFilesList((prev) => [
        ...prev.filter((item) => item.table !== selectedTable),
        { table: selectedTable, filename: file.name, rows: res.row_count },
      ]);
      await queryClient.invalidateQueries();
    } catch (err: any) {
      setUploadErrorMessage("Failed to upload: " + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isRealData = hasData && !activeDataset?.is_synthetic && !workspace?.is_synthetic_demo;

  return (
    <div className="space-y-6">
      {/* Notion Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-2">
        <div>
          <div className="text-4xl mb-2 select-none">🗄️</div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--notion-text)]">
              Data Hub & Store Records
            </h1>
            {hasData ? (
              isRealData ? (
                <span className="notion-pill-green text-xs font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified Customer Data
                </span>
              ) : (
                <span className="notion-pill-gray text-xs font-medium px-2 py-0.5 rounded">
                  Demo Catalog
                </span>
              )
            ) : (
              <span className="notion-pill-yellow text-xs font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Zero State (Awaiting Dataset)
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--notion-text-muted)] mt-1 max-w-2xl">
            Central repository for store transaction records, table contract validations, feature lookback windows, and CSV ingestion.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleLoadRealData}
            disabled={isLoadingReal}
            className="notion-btn-primary flex items-center gap-1.5 text-xs font-medium"
          >
            <Database className={`h-3.5 w-3.5 ${isLoadingReal ? "animate-spin" : ""}`} />
            <span>{isLoadingReal ? "Loading..." : "Load Retail Dataset (1-Click)"}</span>
          </button>
          <button
            onClick={handleResetWorkspace}
            disabled={isResetting}
            className="notion-btn-secondary flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{isResetting ? "Resetting..." : "Reset Workspace"}</span>
          </button>
        </div>
      </div>

      {/* Notion Callout Box */}
      <div className="notion-callout flex items-start gap-3 p-3.5 text-xs">
        <span className="text-base select-none">💡</span>
        <div className="space-y-0.5 text-[var(--notion-text-muted)]">
          <p className="font-semibold text-[var(--notion-text)]">
            How Data Ingestion Works in Persona
          </p>
          <p>
            When no dataset is present, all views start at zero values. Load our bundled retail dataset or upload CSV files matching customers, order lines, offerings, and engagement events to compute live RFM personas and cohort CAC curves.
          </p>
        </div>
      </div>

      {/* Notion Underline Tab Navigation */}
      <div className="flex border-b border-[var(--notion-border)] gap-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab("snapshot")}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "snapshot"
              ? "border-[var(--notion-text)] text-[var(--notion-text)] font-semibold"
              : "border-transparent text-[var(--notion-text-muted)] hover:text-[var(--notion-text)]"
          }`}
        >
          <TableIcon className="h-3.5 w-3.5" />
          <span>Customer Records & Lookback</span>
        </button>
        <button
          onClick={() => setActiveTab("wizard")}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "wizard"
              ? "border-b-[var(--notion-text)] text-[var(--notion-text)] font-semibold"
              : "border-transparent text-[var(--notion-text-muted)] hover:text-[var(--notion-text)]"
          }`}
        >
          <Upload className="h-3.5 w-3.5" />
          <span>Upload CSVs & Kaggle Guide</span>
        </button>
        <button
          onClick={() => setActiveTab("quarantine")}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "quarantine"
              ? "border-b-[var(--notion-text)] text-[var(--notion-text)] font-semibold"
              : "border-transparent text-[var(--notion-text-muted)] hover:text-[var(--notion-text)]"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Data Quality Audit</span>
          {validationData?.issues && validationData.issues.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full notion-pill-yellow text-[10px] font-bold">
              {validationData.issues.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: SNAPSHOT */}
      {activeTab === "snapshot" && (
        <div className="space-y-6">
          {hasData ? (
            <>
              {/* Snapshot Property Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="notion-card p-4 space-y-1">
                  <div className="text-xs text-[var(--notion-text-muted)] font-medium">Customer Profiles</div>
                  <div className="text-2xl font-bold text-[var(--notion-text)] tabular-nums">
                    {formatNumber(activeDataset?.row_counts?.customers ?? 0)}
                  </div>
                  <div className="text-[11px] text-[var(--notion-text-muted)]">
                    Verified unique store shoppers
                  </div>
                </div>

                <div className="notion-card p-4 space-y-1">
                  <div className="text-xs text-[var(--notion-text-muted)] font-medium">Total Order Lines</div>
                  <div className="text-2xl font-bold text-[var(--notion-text)] tabular-nums">
                    {formatNumber(activeDataset?.row_counts?.order_lines ?? 0)}
                  </div>
                  <div className="text-[11px] text-[var(--notion-text-muted)]">
                    Completed item purchases
                  </div>
                </div>

                <div className="notion-card p-4 space-y-1">
                  <div className="text-xs text-[var(--notion-text-muted)] font-medium">Product Catalog</div>
                  <div className="text-2xl font-bold text-[var(--notion-text)] tabular-nums">
                    {formatNumber(activeDataset?.row_counts?.offerings ?? 0)}
                  </div>
                  <div className="text-[11px] text-[var(--notion-text-muted)]">
                    Active retail offerings
                  </div>
                </div>

                <div className="notion-card p-4 space-y-1">
                  <div className="text-xs text-[var(--notion-text-muted)] font-medium">Customer Interactions</div>
                  <div className="text-2xl font-bold text-[var(--notion-text)] tabular-nums">
                    {formatNumber(activeDataset?.row_counts?.engagement_events ?? 0)}
                  </div>
                  <div className="text-[11px] text-[var(--notion-text-muted)]">
                    Visits & cart activities
                  </div>
                </div>
              </div>

              {/* Lookback Recalculation Section */}
              <div className="notion-card p-5 space-y-4">
                <div className="border-b border-[var(--notion-border)] pb-3">
                  <h2 className="text-sm font-semibold text-[var(--notion-text)] flex items-center gap-2">
                    <span>⏱️</span>
                    <span>Update Customer Purchasing Window</span>
                  </h2>
                  <p className="text-xs text-[var(--notion-text-muted)] mt-0.5">
                    Recalculates customer purchase frequency, recency, and basket value across the specified lookback days.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--notion-text)] mb-1.5">
                      Cutoff Date
                    </label>
                    <input
                      type="date"
                      value={asOfDate}
                      onChange={(e) => setAsOfDate(e.target.value)}
                      className="w-full notion-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--notion-text)] mb-1.5">
                      Lookback Window (Days)
                    </label>
                    <input
                      type="number"
                      value={lookbackDays}
                      onChange={(e) => setLookbackDays(Number(e.target.value))}
                      className="w-full notion-input text-xs"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleBuildFeatures}
                      disabled={isBuildingFeatures}
                      className="w-full notion-btn-primary flex items-center justify-center gap-1.5 text-xs py-2"
                    >
                      <Play className={`h-3.5 w-3.5 ${isBuildingFeatures ? "animate-spin" : ""}`} />
                      <span>{isBuildingFeatures ? "Updating..." : "Recalculate Profiles"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="notion-card p-12 text-center space-y-4">
              <NotionEmptyStateIllustration className="w-56 h-auto mx-auto" />
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-semibold text-[var(--notion-text)]">No Store Dataset Loaded</h3>
                <p className="text-xs text-[var(--notion-text-muted)] mt-1 leading-relaxed">
                  Every metric, customer count, and chart begins at zero. Click the button below to load our 2,000-customer retail store benchmark or upload your own CSV files.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleLoadRealData}
                  disabled={isLoadingReal}
                  className="notion-btn-primary flex items-center gap-2 text-xs px-4 py-2"
                >
                  <Database className={`h-4 w-4 ${isLoadingReal ? "animate-spin" : ""}`} />
                  <span>{isLoadingReal ? "Loading..." : "Load Retail Dataset (1-Click)"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: UPLOAD & KAGGLE GUIDE */}
      {activeTab === "wizard" && (
        <div className="space-y-6">
          {/* Kaggle Guide Card */}
          <div className="notion-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--notion-border)] pb-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--notion-text)] flex items-center gap-2">
                  <span>📚</span>
                  <span>Public Retail Datasets & Kaggle Benchmarks</span>
                </h2>
                <p className="text-xs text-[var(--notion-text-muted)] mt-0.5">
                  Persona Studio works out of the box with standard retail CSV schemas. Explore popular public benchmarks below:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[var(--notion-text)]">UCI Online Retail II</div>
                  <a
                    href="https://www.kaggle.com/datasets/mashlyn/online-retail-ii-uci"
                    target="_blank"
                    rel="noreferrer"
                    className="notion-pill-blue text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1"
                  >
                    Kaggle <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <p className="text-[11px] text-[var(--notion-text-muted)]">
                  541,909 real online retail orders with customer IDs, item prices, and invoice timestamps.
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[var(--notion-text)]">Brazilian E-Commerce (Olist)</div>
                  <a
                    href="https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce"
                    target="_blank"
                    rel="noreferrer"
                    className="notion-pill-blue text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1"
                  >
                    Kaggle <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <p className="text-[11px] text-[var(--notion-text-muted)]">
                  100k customer orders from Brazilian marketplaces with order status, payments, and reviews.
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[var(--notion-text)]">Instacart Market Basket</div>
                  <a
                    href="https://www.kaggle.com/c/instacart-market-basket-analysis/data"
                    target="_blank"
                    rel="noreferrer"
                    className="notion-pill-blue text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1"
                  >
                    Kaggle <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <p className="text-[11px] text-[var(--notion-text-muted)]">
                  3M+ grocery orders with reorder sequences and basket category affinities.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive CSV Ingestion Card */}
          <div className="notion-card p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--notion-border)] pb-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--notion-text)] flex items-center gap-2">
                  <span>📥</span>
                  <span>Upload Custom Store CSV Files</span>
                </h2>
                <p className="text-xs text-[var(--notion-text-muted)] mt-0.5">
                  Select the target store table and upload your CSV.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newDatasetName}
                  onChange={(e) => setNewDatasetName(e.target.value)}
                  placeholder="Dataset Name..."
                  className="notion-input text-xs"
                />
                <button
                  onClick={handleCreateDraft}
                  className="notion-btn-primary text-xs shrink-0"
                >
                  Create Draft
                </button>
              </div>
            </div>

            {/* Target Table Selector */}
            <div>
              <label className="block text-xs font-medium text-[var(--notion-text)] mb-2">
                1. Select Target Table:
              </label>
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                {["customers", "order_lines", "offerings", "engagement_events", "experiment_outcomes"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTable(t)}
                    className={`px-3 py-1.5 rounded border capitalize transition-all flex items-center gap-1.5 ${
                      selectedTable === t
                        ? "bg-[var(--notion-text)] text-[var(--notion-bg)] font-semibold border-[var(--notion-text)]"
                        : "bg-[var(--notion-card-bg)] text-[var(--notion-text-muted)] border-[var(--notion-border)] hover:text-[var(--notion-text)]"
                    }`}
                  >
                    <span>{t.replace("_", " ")}</span>
                    {uploadedFilesList.some((item) => item.table === t) && (
                      <Check className="h-3 w-3 text-emerald-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Dropzone */}
            <div>
              <label className="block text-xs font-medium text-[var(--notion-text)] mb-2">
                2. Choose CSV File for <span className="capitalize font-semibold text-[var(--notion-text)]">{selectedTable.replace("_", " ")}</span>:
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-file-input"
              />

              <label
                htmlFor="csv-file-input"
                className="p-8 border-2 border-dashed border-[var(--notion-border)] rounded-lg text-center transition-all cursor-pointer block hover:border-[var(--notion-text-muted)] hover:bg-[var(--notion-sidebar-bg)]"
              >
                <Upload className="h-6 w-6 mx-auto mb-2 text-[var(--notion-text-muted)]" />
                <div className="text-xs font-semibold text-[var(--notion-text)]">
                  {isUploading ? "Uploading & Processing..." : `Click to Browse or Drop CSV for ${selectedTable.replace("_", " ")}`}
                </div>
                <p className="text-[11px] text-[var(--notion-text-muted)] mt-1">
                  Accepts UTF-8 encoded .csv files up to 50MB.
                </p>
              </label>
            </div>

            {/* Status alerts */}
            {uploadSuccessMessage && (
              <div className="p-3 rounded-lg notion-pill-green text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{uploadSuccessMessage}</span>
              </div>
            )}
            {uploadErrorMessage && (
              <div className="p-3 rounded-lg notion-pill-red text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{uploadErrorMessage}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: QUALITY AUDIT */}
      {activeTab === "quarantine" && (
        <div className="notion-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--notion-border)] pb-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--notion-text)] flex items-center gap-2">
                <span>🛡️</span>
                <span>Data Quality & Integrity Audit</span>
              </h2>
              <p className="text-xs text-[var(--notion-text-muted)] mt-0.5">
                Verifies customer order records for valid prices, non-negative amounts, and correct customer IDs.
              </p>
            </div>
            {hasData ? (
              <span className="notion-pill-green text-[10px] font-semibold px-2 py-0.5 rounded">
                {validationData?.issues?.length || 0} Issues
              </span>
            ) : (
              <span className="notion-pill-gray text-[10px] font-medium px-2 py-0.5 rounded">
                No Data
              </span>
            )}
          </div>

          {hasData ? (
            <div className="p-8 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] text-center space-y-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto" />
              <p className="text-xs font-semibold text-[var(--notion-text)]">All Customer Records Verified</p>
              <p className="text-xs text-[var(--notion-text-muted)] max-w-md mx-auto leading-relaxed">
                No active quarantined rows found. Referential customer integrity, price values, and transaction dates verified across all loaded records.
              </p>
            </div>
          ) : (
            <div className="p-8 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] text-center space-y-2">
              <NotionEmptyStateIllustration className="w-40 h-auto mx-auto" />
              <p className="text-xs font-semibold text-[var(--notion-text)]">No Dataset Loaded</p>
              <p className="text-xs text-[var(--notion-text-muted)] max-w-md mx-auto leading-relaxed">
                Load or upload store records to run data quality checks and integrity audits.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
