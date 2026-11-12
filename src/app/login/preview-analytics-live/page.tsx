import { notFound } from "next/navigation";
import { AnalyticsLivePreview } from "./preview-client";
export default function Page(){if(process.env.NODE_ENV!=="development")notFound();return <AnalyticsLivePreview/>;}
