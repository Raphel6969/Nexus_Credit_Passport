// VPA (Virtual Payment Address) extraction from UPI narration strings.
//
// UPI narrations from Indian banks follow patterns like:
//   UPI/CR/240115143000/PhonePe/9876543210@ybl/Salary Jan
//   UPI/DR/240115194500/Swiggy/merchant@paytm/Food Order
//   UPI/CR/NEFT REF/beneficiary@okicici/Description
//
// A VPA matches the pattern: localPart@handle (e.g. merchant@paytm, user@okicici)
// This regex is intentionally conservative — false negatives are OK; false positives
// (storing the wrong identifier) are not.
package normalize

import "regexp"

// vpaPattern matches VPAs in UPI narration strings.
// Pattern: one or more alphanum/dot/underscore/hyphen chars, @, one or more alpha chars.
var vpaPattern = regexp.MustCompile(`\b([a-zA-Z0-9._\-]+@[a-zA-Z][a-zA-Z0-9]+)\b`)

// ExtractVPA attempts to extract a UPI Virtual Payment Address from a narration string.
// Returns the first match found, or empty string if none found.
// Only called when transaction mode == "UPI".
func ExtractVPA(narration string) string {
	matches := vpaPattern.FindStringSubmatch(narration)
	if len(matches) < 2 {
		return ""
	}
	return matches[1]
}
