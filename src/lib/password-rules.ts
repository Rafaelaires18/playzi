export const PASSWORD_ALLOWED_SPECIAL_CHARS = "!@#$%^&*()_+-=?.,:;/\\\\'\"[]{}<>";

function hasAllowedSpecialChar(value: string) {
    for (const char of value) {
        if (PASSWORD_ALLOWED_SPECIAL_CHARS.includes(char)) {
            return true;
        }
    }
    return false;
}

export function evaluatePasswordRules(value: string) {
    return {
        hasMinLength: value.length >= 8,
        hasUppercase: /[A-Z]/.test(value),
        hasDigit: /\d/.test(value),
        hasSpecial: hasAllowedSpecialChar(value),
    };
}

export function arePasswordRulesSatisfied(rules: ReturnType<typeof evaluatePasswordRules>) {
    return rules.hasMinLength && rules.hasUppercase && rules.hasDigit && rules.hasSpecial;
}

export function isPasswordCompositionValid(value: string) {
    return arePasswordRulesSatisfied(evaluatePasswordRules(value));
}
