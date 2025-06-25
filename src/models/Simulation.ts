// src/models/Simulation.ts
import mongoose, { Document, Schema } from 'mongoose';

// Subdocumento para um item dentro de uma simulação (é uma cópia)
const SimulationItemSchema = new Schema({
    name: { type: String, required: true },
    shape: { type: String, required: true },
    quantity: { type: Number, required: true },
    weight: { type: Number, required: true },
    dimensions: {
        length: { type: Number, required: true },
        width: { type: Number, required: true },
        height: { type: Number, required: true },
    },
    isNonStackable: { type: Boolean, required: true },
}, { _id: false });

// Subdocumento para um item que foi efetivamente empacotado
const PackedItemSchema = new Schema({
    name: { type: String, required: true },
    color: { type: String },
    position: { x: Number, y: Number, z: Number },
    rotation: { x: Number, y: Number, z: Number },
    effectiveDimensions: { length: Number, width: Number, height: Number },
}, { _id: false });


export interface ISimulation extends Document {
    userId: mongoose.Schema.Types.ObjectId;
    shipmentReference?: string;
    algorithmUsed: 'ffd' | 'bfd';
    status: 'completed' | 'failed' | 'processing';
    inputs: {
        containerSpec: {
            name: string;
            length: number;
            width: number;
            height: number;
            maxPayloadKg: number;
        };
        items: any[]; // Array de SimulationItemSchema
    };
    results?: {
        totalPackedWeight: number;
        totalPackedVolume: number;
        utilizationPercent: number;
        containers: {
            containerId: number;
            packedWeight: number;
            packedVolume: number;
            packedItems: any[]; // Array de PackedItemSchema
        }[];
        unplacedItems: {
            name: string;
            quantity: number;
            reason: string;
        }[];
    };
    createdAt: Date;
}

const SimulationSchema: Schema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shipmentReference: { type: String, trim: true },
    algorithmUsed: { type: String, enum: ['ffd', 'bfd'], required: true },
    status: { type: String, enum: ['completed', 'failed', 'processing'], default: 'processing' },
    inputs: {
        containerSpec: {
            name: { type: String, required: true },
            length: { type: Number, required: true },
            width: { type: Number, required: true },
            height: { type: Number, required: true },
            maxPayloadKg: { type: Number, required: true },
        },
        items: [SimulationItemSchema],
    },
    results: {
        totalPackedWeight: Number,
        totalPackedVolume: Number,
        utilizationPercent: Number,
        containers: [{
            containerId: Number,
            packedWeight: Number,
            packedVolume: Number,
            packedItems: [PackedItemSchema],
        }],
        unplacedItems: [{
            name: String,
            quantity: Number,
            reason: String,
        }],
    }
}, { timestamps: { createdAt: true, updatedAt: false } }); // Apenas createdAt para simulações

const Simulation = mongoose.model<ISimulation>('Simulation', SimulationSchema);
export default Simulation;