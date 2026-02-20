import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerContentTools(server: McpServer) {
    server.registerTool(
        "clinical_sync_content",
        {
            title: "Sync/Search Clinical Content",
            description: `Retrieves or synchronizes clinical content from the IBCC library.
This tool allows the AI to fetch specific chapters or topics to provide up-to-date protocol guidance.

Note: Currently acting as a mock interface reading from hardcoded summaries until DB integration is defined.

Args:
  - topic (string): The clinical topic or chapter to search for (e.g., 'Resuscitation', 'Neurology', 'Pulmonology', 'DKA').

Returns:
  A structured object containing the content summary and source reference.`,
            inputSchema: z.object({
                topic: z.string()
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ topic }) => {
            // Mock content database
            const mockDb: Record<string, string> = {
                "Resuscitation": "Core principles of fluid therapy, vasopressors, and airway management. Prioritize ABCs. For septic shock, target MAP >65 mmHg.",
                "Neurology": "Management of acute stroke, status epilepticus, and elevated ICP. Target normothermia, specific blood pressure parameters depending on pathology (e.g., <185/110 for ischemic stroke receiving tPA).",
                "Pulmonology": "ARDSnet protocol: Low tidal volume ventilation (6 cc/kg ideal body weight), peep/fio2 titration. Asthma exacerbation: Continuous nebulizers, steroids, consider magnesium.",
                "DKA": "Diabetic Ketoacidosis management: 1. Fluid resuscitation (NS or LR). 2. Insulin infusion (0.1 U/kg/hr). 3. Potassium replacement. Do not stop insulin until anion gap is closed.",
            };

            const normalizedTopic = Object.keys(mockDb).find(k =>
                topic.toLowerCase().includes(k.toLowerCase()) ||
                k.toLowerCase().includes(topic.toLowerCase())
            );

            let content = "";
            if (normalizedTopic) {
                content = mockDb[normalizedTopic];
            } else {
                content = `No specific mock content found for topic: '${topic}'. Available topics: ${Object.keys(mockDb).join(", ")}`;
            }

            const output = {
                requested_topic: topic,
                matched_category: normalizedTopic || null,
                content: content,
                source: "IBCC Mock Database"
            };

            const textContent = `## Topic: ${normalizedTopic || topic}\n\n**Content:** ${content}\n\n*Source: IBCC Mock Database*`;

            return {
                content: [{ type: "text", text: textContent }],
                structuredContent: output
            };
        }
    );
}
