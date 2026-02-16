"use client";

import { useState } from "react";
import { X, Copy, Check, Loader2, ExternalLink, Phone, Mail, Globe } from "lucide-react";
import { VerifiedDoctor, OutreachAssets, MockLandingPage } from "../lib/types";
import TierBadge from "./TierBadge";

interface Props {
  doctor: VerifiedDoctor;
  onClose: () => void;
  isDemo?: boolean;
}

export default function DoctorProfile({ doctor, onClose, isDemo }: Props) {
  const [outreach, setOutreach] = useState<OutreachAssets | null>(null);
  const [mockPage, setMockPage] = useState<MockLandingPage | null>(null);
  const [loadingOutreach, setLoadingOutreach] = useState(false);
  const [loadingMockPage, setLoadingMockPage] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"contact" | "outreach" | "mockpage">("contact");

  const name = doctor.identity.fullDisplay || doctor.channel.title;
  const ytUrl = doctor.channel.customUrl
    ? `https://youtube.com/${doctor.channel.customUrl}`
    : `https://youtube.com/channel/${doctor.channel.channelId}`;

  async function handleGenerateOutreach() {
    setLoadingOutreach(true);
    try {
      const res = await fetch("/api/pipeline/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctor }),
      });
      const data = await res.json();
      if (data.assets) {
        setOutreach(data.assets);
        setActiveTab("outreach");
      }
    } catch (err) {
      console.error("Outreach generation failed:", err);
    } finally {
      setLoadingOutreach(false);
    }
  }

  async function handleGenerateMockPage() {
    setLoadingMockPage(true);
    try {
      const res = await fetch("/api/pipeline/mock-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctor }),
      });
      const data = await res.json();
      if (data.mockPage) {
        setMockPage(data.mockPage);
        setActiveTab("mockpage");
      }
    } catch (err) {
      console.error("Mock page generation failed:", err);
    } finally {
      setLoadingMockPage(false);
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30">
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4">
          <div className="flex items-center gap-3">
            {doctor.channel.thumbnailUrl && (
              <img
                src={doctor.channel.thumbnailUrl}
                alt={name}
                className="h-10 w-10 rounded-full"
              />
            )}
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{name}</h2>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <TierBadge tier={doctor.verification.tier} />
                <span>{doctor.verification.confidence}% confidence</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Channel Info */}
        <div className="border-b p-4">
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div>
              <div className="font-semibold text-gray-900">
                {doctor.channel.subscriberCount >= 0
                  ? doctor.channel.subscriberCount.toLocaleString()
                  : "Hidden"}
              </div>
              <div className="text-gray-500">Subscribers</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">{doctor.channel.videoCount.toLocaleString()}</div>
              <div className="text-gray-500">Videos</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">{doctor.channel.viewCount.toLocaleString()}</div>
              <div className="text-gray-500">Views</div>
            </div>
          </div>
          <a
            href={ytUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> View on YouTube
          </a>
        </div>

        {/* Verification Details */}
        <div className="border-b p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Verification</h3>
          <div className="space-y-1 text-xs text-gray-700">
            <div>Credentials: {doctor.identity.credentials || "Not found"}</div>
            <div>Dermatologist: {doctor.identity.isDermatologist ? "Yes" : "Unknown"}</div>
            <div>Board Certified: {doctor.identity.boardCertified === true ? "Yes" : doctor.identity.boardCertified === false ? "No" : "Unknown"}</div>
            {doctor.verification.npiMatch && (
              <div>NPI: {doctor.verification.npiMatch.npiNumber} ({doctor.verification.npiMatch.taxonomyDescription})</div>
            )}
            <div className="text-gray-400">Reasoning: {doctor.verification.reasoning}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {(["contact", "outreach", "mockpage"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-medium ${
                activeTab === tab
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "contact" ? "Contact" : tab === "outreach" ? "Outreach" : "Mock Page"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === "contact" && (
            <div className="space-y-3">
              <ContactRow icon={<Mail className="h-4 w-4" />} label="Email" value={doctor.contact.email} source={doctor.contact.emailSource} onCopy={copyToClipboard} copiedField={copiedField} />
              <ContactRow icon={<Phone className="h-4 w-4" />} label="Phone" value={doctor.contact.phone} source={doctor.contact.phoneSource} onCopy={copyToClipboard} copiedField={copiedField} />
              <ContactRow icon={<Globe className="h-4 w-4" />} label="LinkedIn" value={doctor.contact.linkedinUrl} source={doctor.contact.linkedinSource} onCopy={copyToClipboard} copiedField={copiedField} isLink />
              <ContactRow icon={<Globe className="h-4 w-4" />} label="Doximity" value={doctor.contact.doximityUrl} source={doctor.contact.doximitySource} onCopy={copyToClipboard} copiedField={copiedField} isLink />
              <ContactRow icon={<Globe className="h-4 w-4" />} label="Website" value={doctor.contact.website} source={doctor.contact.websiteSource} onCopy={copyToClipboard} copiedField={copiedField} isLink />
              {doctor.contact.instagramHandle && (
                <ContactRow icon={<Globe className="h-4 w-4" />} label="Instagram" value={`@${doctor.contact.instagramHandle}`} source={null} onCopy={copyToClipboard} copiedField={copiedField} />
              )}
              <div className="mt-2 text-xs text-gray-400">
                Sources checked: {doctor.contact.allSourcesChecked.join(", ")}
              </div>
            </div>
          )}

          {activeTab === "outreach" && (
            <div>
              {isDemo ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                    <p className="text-sm font-medium text-gray-700">AI Outreach Generation</p>
                    <p className="mt-1 text-xs text-gray-500">
                      In live mode, this generates personalized email, LinkedIn, Doximity, and SMS
                      outreach copy using the doctor&apos;s channel data, credentials, and content
                      themes. Disabled in demo — outreach messaging requires alignment with
                      FutureClinic&apos;s brand voice and current GTM strategy before deployment.
                    </p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                    <strong>Infrastructure ready:</strong> The outreach pipeline accepts a doctor
                    profile and generates multi-channel copy via Claude Sonnet. The templates,
                    tone, and value propositions would be configured in collaboration with the
                    growth team.
                  </div>
                </div>
              ) : !outreach ? (
                <button
                  onClick={handleGenerateOutreach}
                  disabled={loadingOutreach}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loadingOutreach ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                  ) : (
                    "Generate Outreach"
                  )}
                </button>
              ) : (
                <OutreachDisplay assets={outreach} onCopy={copyToClipboard} copiedField={copiedField} />
              )}
            </div>
          )}

          {activeTab === "mockpage" && (
            <div>
              {isDemo ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                    <p className="text-sm font-medium text-gray-700">Personalized Landing Page Preview</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Generates a mock FutureClinic landing page for each doctor — personalized
                      with their name, specialty, subscriber proof, and suggested services.
                      Useful for outreach to show doctors what their clinic page could look like.
                    </p>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-3 text-xs text-purple-700">
                    <strong>Proof of concept:</strong> This feature demonstrates how personalized
                    assets can be auto-generated at scale to support sales outreach. Page design
                    would mirror FutureClinic&apos;s actual product UI.
                  </div>
                </div>
              ) : !mockPage ? (
                <button
                  onClick={handleGenerateMockPage}
                  disabled={loadingMockPage}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {loadingMockPage ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                  ) : (
                    "Generate Mock Page"
                  )}
                </button>
              ) : (
                <MockPagePreview page={mockPage} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  source,
  onCopy,
  copiedField,
  isLink,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  source: string | null;
  onCopy: (text: string, field: string) => void;
  copiedField: string | null;
  isLink?: boolean;
}) {
  if (!value) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        {icon}
        <span>{label}: Not found</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs">
        {icon}
        <span className="text-gray-500">{label}:</span>
        {isLink ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            {value.replace(/^https?:\/\//, "").slice(0, 40)}
          </a>
        ) : (
          <span className="font-medium text-gray-900">{value}</span>
        )}
        {source && <span className="text-gray-400">({source})</span>}
      </div>
      <button
        onClick={() => onCopy(value, label)}
        className="rounded p-1 hover:bg-gray-100"
      >
        {copiedField === label ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3 text-gray-400" />
        )}
      </button>
    </div>
  );
}

function OutreachDisplay({
  assets,
  onCopy,
  copiedField,
}: {
  assets: OutreachAssets;
  onCopy: (text: string, field: string) => void;
  copiedField: string | null;
}) {
  const [emailIdx, setEmailIdx] = useState(0);

  return (
    <div className="space-y-4">
      {/* Email variants */}
      {assets.emailVariants && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase text-gray-500">Email</h4>
            <div className="flex gap-1">
              {assets.emailVariants.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setEmailIdx(i)}
                  className={`rounded px-2 py-0.5 text-xs ${
                    emailIdx === i ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {String.fromCharCode(65 + i)}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="mb-1 text-xs font-medium text-gray-700">
              Subject: {assets.emailVariants[emailIdx].subject}
            </div>
            <div className="whitespace-pre-wrap text-xs text-gray-600">
              {assets.emailVariants[emailIdx].body}
            </div>
            <button
              onClick={() =>
                onCopy(
                  `Subject: ${assets.emailVariants![emailIdx].subject}\n\n${assets.emailVariants![emailIdx].body}`,
                  `email-${emailIdx}`
                )
              }
              className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              {copiedField === `email-${emailIdx}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              Copy
            </button>
          </div>
        </div>
      )}

      {/* LinkedIn */}
      {assets.linkedinConnectionRequest && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">LinkedIn Connection</h4>
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            {assets.linkedinConnectionRequest}
            <div className="mt-1 text-gray-400">{assets.linkedinConnectionRequest.length}/300 chars</div>
          </div>
          <button
            onClick={() => onCopy(assets.linkedinConnectionRequest!, "linkedin")}
            className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            {copiedField === "linkedin" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy
          </button>
        </div>
      )}

      {/* Doximity */}
      {assets.doximityMessage && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">Doximity Message</h4>
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            {assets.doximityMessage}
          </div>
          <button
            onClick={() => onCopy(assets.doximityMessage!, "doximity")}
            className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            {copiedField === "doximity" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy
          </button>
        </div>
      )}

      {/* Phone/SMS */}
      {assets.smsMessage && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">SMS</h4>
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            {assets.smsMessage}
            <div className="mt-1 text-gray-400">{assets.smsMessage.length}/160 chars</div>
          </div>
          <button
            onClick={() => onCopy(assets.smsMessage!, "sms")}
            className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            {copiedField === "sms" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy
          </button>
        </div>
      )}
    </div>
  );
}

function MockPagePreview({ page }: { page: MockLandingPage }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-b from-blue-50 to-white">
      <div className="p-6 text-center">
        <img
          src={page.avatarUrl}
          alt={page.doctorName}
          className="mx-auto mb-3 h-16 w-16 rounded-full border-2 border-white shadow"
        />
        <h3 className="text-lg font-bold text-gray-900">{page.doctorName}</h3>
        <p className="text-xs text-blue-600">{page.specialty}</p>
        <p className="mt-2 text-sm text-gray-600">{page.heroTagline}</p>
        <p className="mt-1 text-xs text-gray-400">{page.subscriberProof}</p>
      </div>
      <div className="border-t px-6 py-4">
        <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Services</h4>
        <ul className="space-y-1">
          {page.services.map((s, i) => (
            <li key={i} className="text-xs text-gray-700">• {s}</li>
          ))}
        </ul>
      </div>
      <div className="border-t px-6 py-4 text-center">
        <div className="text-lg font-bold text-gray-900">{page.monthlyPrice}</div>
        <button className="mt-2 w-full rounded-full bg-blue-600 py-2 text-sm font-medium text-white">
          {page.ctaText}
        </button>
      </div>
      <div className="bg-gray-50 px-6 py-2 text-center text-xs text-gray-400">
        Powered by Future Clinic
      </div>
    </div>
  );
}
