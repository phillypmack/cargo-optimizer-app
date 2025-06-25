// src/models/User.ts
import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

// Interface para definir a estrutura do documento de usuário
export interface IUser extends Document {
    email: string;
    password?: string;
    googleId?: string;
    authProvider: 'local' | 'google';
    displayName: string;
    isAdmin: boolean;
    isEmailVerified: boolean;
    emailVerificationToken?: string;
    emailVerificationTokenExpires?: Date;
    registeredAt: Date;
    lastLoginAt?: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

// Schema do Mongoose
const UserSchema: Schema = new Schema({
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
    authProvider: { type: String, enum: ['local', 'google'], required: true },
    displayName: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationTokenExpires: { type: Date, select: false },
    registeredAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date }
});

UserSchema.pre('save', async function (next) {
    // Usamos 'any' para evitar problemas com a tipagem de 'this' dentro do hook do Mongoose
    const user = this as any;
    if (user.isModified('password') && user.password) {
        const salt = await bcrypt.genSalt(10);
        // Garantimos que o password seja uma string antes de fazer o hash
        user.password = await bcrypt.hash(String(user.password), salt);
    }
    next();
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model<IUser>('User', UserSchema);
export default User;