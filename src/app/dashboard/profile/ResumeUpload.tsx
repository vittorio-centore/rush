"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { saveResumeUrl } from "./actions";

interface ResumeUploadProps {
  userId: string;
  currentResumePath: string | null;
}

export default function ResumeUpload({ userId, currentResumePath }: ResumeUploadProps) {
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!currentResumePath) return;

    const supabase = createClient();
    supabase.storage
      .from("resumes")
      .createSignedUrl(currentResumePath, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) {
          setResumeUrl(data.signedUrl);
        }
      });
  }, [currentResumePath]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setErrorMessage("Only PDF files are allowed.");
      setStatus("error");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("File must be under 10 MB.");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setErrorMessage(null);

    const supabase = createClient();
    const storagePath = `${userId}/resume.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(storagePath, file, { upsert: true, contentType: "application/pdf" });

    if (uploadError) {
      setErrorMessage(uploadError.message);
      setStatus("error");
      return;
    }

    try {
      await saveResumeUrl(storagePath);
      setStatus("success");

      const { data } = await supabase.storage
        .from("resumes")
        .createSignedUrl(storagePath, 3600);
      if (data?.signedUrl) {
        setResumeUrl(data.signedUrl);
      }
    } catch {
      setErrorMessage("Upload succeeded but failed to save to profile. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm max-w-lg flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Resume</h2>
        <p className="text-sm text-slate-500 mt-1">
          Upload a PDF resume. Clubs may request this as part of their application.
        </p>
      </div>

      {resumeUrl && (
        <div className="flex items-center gap-2">
          <a
            href={resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            View current resume
          </a>
        </div>
      )}

      <div>
        <label
          htmlFor="resume"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          {currentResumePath ? "Replace resume" : "Upload resume"}
        </label>
        <input
          id="resume"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={status === "uploading"}
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {status === "uploading" && (
        <p className="text-sm text-slate-500">Uploading...</p>
      )}
      {status === "success" && (
        <p className="text-sm text-green-700">Resume uploaded successfully.</p>
      )}
      {status === "error" && errorMessage && (
        <p className="text-sm text-red-700">{errorMessage}</p>
      )}
    </div>
  );
}
