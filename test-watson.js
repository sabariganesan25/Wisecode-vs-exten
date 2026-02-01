const axios = require('axios');
require('dotenv').config();

async function test() {
    try {
        const tokenRes = await axios.post(
            'https://iam.cloud.ibm.com/identity/token',
            `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${process.env.IBM_API_KEY}`,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        console.log('TOKEN OK');

        // Try granite code model
        const genRes = await axios.post(
            'https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2024-01-10',
            {
                model_id: 'ibm/granite-34b-code-instruct',
                project_id: process.env.WATSONX_PROJECT_ID,
                input: 'Say hello in JSON format: {"message":"Hello"}',
                parameters: { max_new_tokens: 30, decoding_method: 'greedy' }
            },
            {
                headers: { 'Authorization': `Bearer ${tokenRes.data.access_token}`, 'Content-Type': 'application/json' }
            }
        );
        console.log('SUCCESS:', genRes.data.results?.[0]?.generated_text);
    } catch (e) {
        console.log('STATUS:', e.response?.status);

        // Try another model - granite-20b-code-instruct
        try {
            const tokenRes2 = await axios.post(
                'https://iam.cloud.ibm.com/identity/token',
                `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${process.env.IBM_API_KEY}`,
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            const genRes2 = await axios.post(
                'https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2024-01-10',
                {
                    model_id: 'ibm/granite-20b-code-instruct',
                    project_id: process.env.WATSONX_PROJECT_ID,
                    input: 'Return: {"status":"ok"}',
                    parameters: { max_new_tokens: 20 }
                },
                {
                    headers: { 'Authorization': `Bearer ${tokenRes2.data.access_token}`, 'Content-Type': 'application/json' }
                }
            );
            console.log('FALLBACK MODEL SUCCESS:', genRes2.data.results?.[0]?.generated_text);
        } catch (e2) {
            console.log('FALLBACK STATUS:', e2.response?.status);
            console.log('ALL MODELS FAILED');
        }
    }
}
test();
