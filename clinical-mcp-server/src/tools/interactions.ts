import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerInteractionsTools(server: McpServer) {
    server.registerTool(
        "clinical_check_interactions",
        {
            title: "Check Drug Interactions",
            description: `Checks for known interactions between a list of specified drugs.
Returns a list of potential interactions, severity, and clinical management advice.

Note: This is currently a simulated/placeholder implementation providing mock data for testing.

Args:
  - drugs (array of strings): Array of drug names to check (e.g., ["lisinopril", "potassium chloride"]).
  - severity_threshold (string, optional): Filter by minimum severity ('minor', 'moderate', 'major', 'contraindicated'). Defaults to 'minor'.

Returns:
  A structured object detailing any found interactions.`,
            inputSchema: z.object({
                drugs: z.array(z.string()).min(2, "Must provide at least two drugs to check for interactions"),
                severity_threshold: z.enum(["minor", "moderate", "major", "contraindicated"]).default("minor")
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ drugs, severity_threshold }) => {
            // Placeholder mock implementation
            const lowerDrugs = drugs.map(d => d.toLowerCase());
            const interactions = [];

            // Mock interaction Check
            if (lowerDrugs.includes("lisinopril") && (lowerDrugs.includes("potassium") || lowerDrugs.includes("potassium chloride"))) {
                interactions.push({
                    drugs: ["lisinopril", "potassium chloride"],
                    severity: "major",
                    description: "Concurrent use of ACE inhibitors and potassium supplements can increase the risk of hyperkalemia.",
                    management: "Monitor serum potassium closely, especially in patients with renal impairment."
                });
            }

            if (lowerDrugs.includes("omeprazole") && lowerDrugs.includes("clopidogrel")) {
                interactions.push({
                    drugs: ["omeprazole", "clopidogrel"],
                    severity: "major",
                    description: "Omeprazole may significantly reduce the antiplatelet activity of clopidogrel by inhibiting CYP2C19.",
                    management: "Consider an alternative acid-reducing agent like pantoprazole or ranitidine."
                });
            }

            const output = {
                checked_drugs: drugs,
                interactions_found: interactions.length,
                interactions: interactions
            };

            let textContent = `Checked interactions for: ${drugs.join(", ")}\n\n`;
            if (interactions.length === 0) {
                textContent += "No known interactions found in the mock database for the provided list.";
            } else {
                textContent += `Found ${interactions.length} interaction(s):\n\n`;
                interactions.forEach((int, index) => {
                    textContent += `${index + 1}. [${int.severity.toUpperCase()}] ${int.drugs.join(" + ")}\n`;
                    textContent += `   Description: ${int.description}\n`;
                    textContent += `   Management: ${int.management}\n\n`;
                });
            }

            return {
                content: [{ type: "text", text: textContent }],
                structuredContent: output
            };
        }
    );
}
