export interface ContactData {
    name: string;
    phone: string;
}

export interface ChatMessage {
    sender: 'user' | 'ai';
    text: string;
}

export interface LeadData extends ContactData {
    timestamp: string;
    source: string;
    userId?: string;
    status: string;
}
