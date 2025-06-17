## Code-Together
<p>A Realtime collaboration Code editor</p>

![image](https://github.com/astro-heree/Code-Together/assets/105852549/06780d71-c089-435d-8b38-ce6961a897b8.png)
![image](https://github.com/astro-heree/Code-Together/assets/105852549/03beb854-b472-4034-bb75-acbcbca19543.png)

### Tech Stack - 
- ReactJs
- SocketIo
- CodeMirror
- ExpressJs

### Environment Setup

1. Create a `.env` file in the root directory with the following variables:
```
REACT_APP_BACKEND_URL=http://localhost:8080
LIVEKIT_API_KEY=your_api_key_here
LIVEKIT_API_SECRET=your_api_secret_here
LIVEKIT_URL=your_livekit_url_here
```

2. For production deployment on Render:
   - Add these environment variables in your Render dashboard
   - Set `REACT_APP_BACKEND_URL` to your Render app URL
   - Configure LiveKit credentials

### Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

### Production
```bash
# Build and run
npm run build
npm run server:pod
```
