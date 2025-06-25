// src/models/Item.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IItem extends Document {
    userId: mongoose.Schema.Types.ObjectId;
    name: string;
    shape: 'box' | 'cylinder';
    dimensions: {
        length: number; // Para cilindro, representa o diâmetro
        width: number;  // Para cilindro, é igual ao comprimento/diâmetro
        height: number;
    };
    weight: number;
    isNonStackable: boolean;
    rotationPreferences: {
        allowX: boolean;
        allowY: boolean;
        allowZ: boolean;
    };
    defaultColor?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ItemSchema: Schema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    shape: { type: String, enum: ['box', 'cylinder'], required: true },
    dimensions: {
        length: { type: Number, required: true, min: 0.01 },
        width: { type: Number, required: true, min: 0.01 },
        height: { type: Number, required: true, min: 0.01 },
    },
    weight: { type: Number, required: true, min: 0 },
    isNonStackable: { type: Boolean, default: false },
    rotationPreferences: {
        allowX: { type: Boolean, default: true },
        allowY: { type: Boolean, default: true },
        allowZ: { type: Boolean, default: true },
    },
    defaultColor: { type: String },
}, { timestamps: true }); // 'timestamps' cria createdAt e updatedAt automaticamente

const Item = mongoose.model<IItem>('Item', ItemSchema);
export default Item;