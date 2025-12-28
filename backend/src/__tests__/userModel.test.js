const userModel = require('../models/userModel');
const pool = require('../config/db');

jest.mock('../config/db');

describe('User Model', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockUser = {
        user_id: 1, email: 'test@test.com', password_hash: 'hash', 
        full_name: 'Name', student_number: '123', role: 'student', 
        is_verified: true, verification_token: 'token', 
        password_reset_token: 'reset', refresh_token: 'refresh'
    };

    describe('findById', () => {
        test('should find user', async () => {
            pool.query.mockResolvedValue({ rows: [mockUser] });
            const result = await userModel.findById(1);
            expect(result.email).toBe('test@test.com');
        });

        test('should return null if not found', async () => {
            pool.query.mockResolvedValue({ rows: [] });
            expect(await userModel.findById(1)).toBeNull();
        });

        test('should throw on error', async () => {
            pool.query.mockRejectedValue(new Error('fail'));
            await expect(userModel.findById(1)).rejects.toThrow('fail');
        });
    });

    describe('findByEmail', () => {
        test('should find user and lowercase email', async () => {
            pool.query.mockResolvedValue({ rows: [mockUser] });
            const result = await userModel.findByEmail('TEST@TEST.COM');
            expect(result.email).toBe('test@test.com');
            expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['test@test.com']);
        });

        test('should throw on error', async () => {
            pool.query.mockRejectedValue(new Error('fail'));
            await expect(userModel.findByEmail('a@a.com')).rejects.toThrow('fail');
        });
    });

    describe('create', () => {
        test('should create user', async () => {
            pool.query.mockResolvedValue({ rows: [mockUser] });
            const result = await userModel.create({
                email: 't@t.com', passwordHash: 'h', fullName: 'n', studentNumber: 's'
            });
            expect(result.user_id).toBe(1);
        });

        test('should throw on error', async () => {
            pool.query.mockRejectedValue(new Error('fail'));
            await expect(userModel.create({ email: 'a@a.com' })).rejects.toThrow('fail');
        });
    });

    describe('update', () => {
        test('should update valid fields', async () => {
            pool.query.mockResolvedValue({ rows: [mockUser] });
            const result = await userModel.update(1, { full_name: 'new' });
            expect(result.user_id).toBe(1);
        });

        test('should throw if no valid fields', async () => {
            await expect(userModel.update(1, { invalid: 'field' })).rejects.toThrow('No valid fields');
        });

        test('should throw on error', async () => {
            pool.query.mockRejectedValue(new Error('fail'));
            await expect(userModel.update(1, { full_name: 'n' })).rejects.toThrow('fail');
        });
    });

    describe('updateLastLogin', () => {
        test('should update', async () => {
            pool.query.mockResolvedValue({});
            await userModel.updateLastLogin(1);
            expect(pool.query).toHaveBeenCalled();
        });

        test('should throw on error', async () => {
            pool.query.mockRejectedValue(new Error('fail'));
            await expect(userModel.updateLastLogin(1)).rejects.toThrow('fail');
        });
    });

    describe('Tokens', () => {
        test('findByVerificationToken', async () => {
            pool.query.mockResolvedValue({ rows: [mockUser] });
            await userModel.findByVerificationToken('token');
            expect(pool.query).toHaveBeenCalled();
        });

        test('setVerificationToken', async () => {
            pool.query.mockResolvedValue({});
            await userModel.setVerificationToken(1, 'token', 'code', new Date());
            expect(pool.query).toHaveBeenCalled();
        });

        test('clearVerificationToken', async () => {
            pool.query.mockResolvedValue({});
            await userModel.clearVerificationToken(1);
            expect(pool.query).toHaveBeenCalled();
        });

        test('findByEmailAndCode', async () => {
            pool.query.mockResolvedValue({ rows: [mockUser] });
            await userModel.findByEmailAndCode('a@a.com', '123456');
            expect(pool.query).toHaveBeenCalled();
        });

        test('findByPasswordResetToken', async () => {
            pool.query.mockResolvedValue({ rows: [mockUser] });
            await userModel.findByPasswordResetToken('token');
            expect(pool.query).toHaveBeenCalled();
        });

        test('setPasswordResetToken', async () => {
            pool.query.mockResolvedValue({});
            await userModel.setPasswordResetToken(1, 'token', new Date());
            expect(pool.query).toHaveBeenCalled();
        });

        test('clearPasswordResetToken', async () => {
            pool.query.mockResolvedValue({});
            await userModel.clearPasswordResetToken(1);
            expect(pool.query).toHaveBeenCalled();
        });
    });

    describe('Refresh Token', () => {
        test('setRefreshToken', async () => {
            pool.query.mockResolvedValue({});
            await userModel.setRefreshToken(1, 'ref');
            expect(pool.query).toHaveBeenCalled();
        });

        test('clearRefreshToken', async () => {
            pool.query.mockResolvedValue({});
            await userModel.clearRefreshToken(1);
            expect(pool.query).toHaveBeenCalled();
        });

        test('isRefreshTokenValid', async () => {
            pool.query.mockResolvedValue({ rows: [{ refresh_token: 'abc' }] });
            expect(await userModel.isRefreshTokenValid(1, 'abc')).toBe(true);
            expect(await userModel.isRefreshTokenValid(1, 'wrong')).toBe(false);
        });

        test('isRefreshTokenValid catch error', async () => {
            pool.query.mockRejectedValue(new Error('fail'));
            expect(await userModel.isRefreshTokenValid(1, 'a')).toBe(false);
        });
    });

    describe('Failed Logins', () => {
        test('getRecentFailedLoginAttempts', async () => {
            pool.query.mockResolvedValue({ rows: [{ count: '3' }] });
            expect(await userModel.getRecentFailedLoginAttempts(1)).toBe(3);
        });
    });

    describe('Error Handling Generic', () => {
        const methods = [
            'findByVerificationToken', 'setVerificationToken', 'clearVerificationToken',
            'findByEmailAndCode', 'findByPasswordResetToken', 'setPasswordResetToken',
            'clearPasswordResetToken', 'setRefreshToken', 'clearRefreshToken',
            'getRecentFailedLoginAttempts'
        ];

        methods.forEach(method => {
            test(`${method} should throw on DB error`, async () => {
                pool.query.mockRejectedValue(new Error('fail'));
                if (method.includes('Token')) {
                    await expect(userModel[method]('abc', 'abc', new Date())).rejects.toThrow('fail');
                } else if (method === 'findByEmailAndCode') {
                    await expect(userModel[method]('a@a.com', '123456')).rejects.toThrow('fail');
                } else {
                    await expect(userModel[method](1, 'a', 'b')).rejects.toThrow('fail');
                }
            });
        });
    });
});
