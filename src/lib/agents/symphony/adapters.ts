
import { GenerativeModel } from "@google/generative-ai";
import { AgentModel } from "./types";

export class GeminiAgentAdapter implements AgentModel {
    name: string;
    private model: GenerativeModel;

    constructor(name: string, model: GenerativeModel) {
        this.name = name;
        this.model = model;
    }

    async complete(prompt: string): Promise<string> {
        try {
            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error(`Agent ${this.name} failed:`, error);
            throw error;
        }
    }
}
