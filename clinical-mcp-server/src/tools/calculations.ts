import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerCalculationsTools(server: McpServer) {
    server.registerTool(
        "clinical_calculate_score",
        {
            title: "Calculate Clinical Score",
            description: `Calculates various clinical scores based on input parameters.
Currently supports:
- BMI (Body Mass Index)
- Anion Gap
- Corrected Calcium

Args:
  - score_type (enum): The type of score to calculate ('bmi', 'anion_gap', 'corrected_calcium')
  - params (object): The parameters for the specific calculation.
    - For BMI: { weight_kg, height_cm }
    - For Anion Gap: { sodium, chloride, bicarbonate }
    - For Corrected Calcium: { measured_calcium, albumin }

Returns:
  A structured object with the calculated result and interpretation.`,
            inputSchema: z.object({
                score_type: z.enum(["bmi", "anion_gap", "corrected_calcium"]),
                params: z.object({
                    weight_kg: z.number().optional(),
                    height_cm: z.number().optional(),
                    sodium: z.number().optional(),
                    chloride: z.number().optional(),
                    bicarbonate: z.number().optional(),
                    measured_calcium: z.number().optional(),
                    albumin: z.number().optional()
                })
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false
            }
        },
        async ({ score_type, params }) => {
            let resultStr = "";
            let output: Record<string, unknown> = {};

            try {
                switch (score_type) {
                    case "bmi": {
                        if (!params.weight_kg || !params.height_cm) {
                            throw new Error("Missing weight_kg or height_cm for BMI calculation");
                        }
                        const height_m = params.height_cm / 100;
                        const bmi = params.weight_kg / (height_m * height_m);
                        const category = bmi < 18.5 ? "Underweight" :
                            bmi < 25 ? "Normal weight" :
                                bmi < 30 ? "Overweight" : "Obese";
                        output = { bmi, category };
                        resultStr = `BMI: ${bmi.toFixed(1)} (${category})`;
                        break;
                    }

                    case "anion_gap": {
                        if (!params.sodium || !params.chloride || !params.bicarbonate) {
                            throw new Error("Missing parameters for Anion Gap");
                        }
                        const ag = params.sodium - (params.chloride + params.bicarbonate);
                        const ag_interpretation = ag > 12 ? "High" : ag < 8 ? "Low" : "Normal";
                        output = { anion_gap: ag, interpretation: ag_interpretation };
                        resultStr = `Anion Gap: ${ag.toFixed(1)} mEq/L (${ag_interpretation})`;
                        break;
                    }

                    case "corrected_calcium": {
                        if (!params.measured_calcium || !params.albumin) {
                            throw new Error("Missing parameters for Corrected Calcium");
                        }
                        const corrected = params.measured_calcium + 0.8 * (4.0 - params.albumin);
                        output = { corrected_calcium: corrected };
                        resultStr = `Corrected Calcium: ${corrected.toFixed(2)} mg/dL`;
                        break;
                    }
                }

                return {
                    content: [{ type: "text", text: resultStr }],
                    structuredContent: output
                };
            } catch (e: unknown) {
                return {
                    content: [{ type: "text", text: `Error calculating score: ${e instanceof Error ? e.message : String(e)}` }]
                };
            }
        }
    );
}
