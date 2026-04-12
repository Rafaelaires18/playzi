export type ChatReportReasonCode = "insult" | "inappropriate" | "spam" | "harassment" | "other";

type ChatReportReasonDefinition = {
    code: ChatReportReasonCode;
    label: string;
    aliases: string[];
    legacyCodes: string[];
};

const CHAT_REPORT_REASON_DEFINITIONS: ChatReportReasonDefinition[] = [
    {
        code: "insult",
        label: "Insultes ou propos déplacés",
        aliases: ["insulte", "insultes", "propos deplace", "propos déplacé", "propos déplaces"],
        legacyCodes: ["chat_insults"],
    },
    {
        code: "inappropriate",
        label: "Comportement inapproprié",
        aliases: ["comportement inapproprie", "inapproprie", "inapproprié", "abusif"],
        legacyCodes: ["chat_inappropriate_behavior"],
    },
    {
        code: "spam",
        label: "Spam",
        aliases: ["spam"],
        legacyCodes: ["chat_spam"],
    },
    {
        code: "harassment",
        label: "Harcèlement",
        aliases: ["harcelement", "harcèlement"],
        legacyCodes: ["chat_harassment"],
    },
    {
        code: "other",
        label: "Autre",
        aliases: ["autre", "other"],
        legacyCodes: ["chat_other"],
    },
];

const CODE_TO_DEFINITION = new Map(CHAT_REPORT_REASON_DEFINITIONS.map((entry) => [entry.code, entry]));

function normalizeReasonInput(value: string) {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

export const CHAT_REPORT_REASON_OPTIONS = CHAT_REPORT_REASON_DEFINITIONS.map((entry) => ({
    code: entry.code,
    label: entry.label,
}));

export function isChatReportReasonCode(value: string): value is ChatReportReasonCode {
    return CODE_TO_DEFINITION.has(value as ChatReportReasonCode);
}

export function getChatReportReasonLabel(code: string) {
    return CODE_TO_DEFINITION.get(code as ChatReportReasonCode)?.label || "Autre";
}

export function getChatReportReasonFilterCodes(code: string): string[] {
    const definition = CODE_TO_DEFINITION.get(code as ChatReportReasonCode);
    if (!definition) return [code];
    return [definition.code, ...definition.legacyCodes];
}

export function resolveChatReportReason(input: string): { code: ChatReportReasonCode; label: string } {
    const normalized = normalizeReasonInput(input || "");
    if (!normalized) {
        return { code: "other", label: "Autre" };
    }

    const directByCode = CHAT_REPORT_REASON_DEFINITIONS.find(
        (entry) => entry.code === normalized || entry.legacyCodes.includes(normalized)
    );
    if (directByCode) {
        return { code: directByCode.code, label: directByCode.label };
    }

    const keywordMatch = CHAT_REPORT_REASON_DEFINITIONS.find((entry) =>
        entry.aliases.some((alias) => normalized.includes(normalizeReasonInput(alias)))
    );
    if (keywordMatch) {
        return { code: keywordMatch.code, label: keywordMatch.label };
    }

    return { code: "other", label: "Autre" };
}
