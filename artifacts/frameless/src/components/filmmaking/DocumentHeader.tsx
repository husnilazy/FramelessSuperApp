import React from "react";
import { Badge } from "@/components/ui/badge";

interface DocumentHeaderProps {
  title: string;
  docType: "concept" | "script" | "shotlist";
  createdBy: string;
  createdAt: string;
  lastEditedAt: string;
}

export function DocumentHeader({
  title,
  docType,
  createdBy,
  createdAt,
  lastEditedAt,
}: DocumentHeaderProps) {
  return (
    <div className="border-b p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
            <Badge variant="outline" className="capitalize">
              {docType}
            </Badge>
            <span>Created by {createdBy}</span>
            <span>•</span>
            <span>Created {new Date(createdAt).toLocaleDateString()}</span>
            <span>•</span>
            <span>Last edited {new Date(lastEditedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
