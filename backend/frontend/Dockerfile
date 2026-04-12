FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port (Vite default)
EXPOSE 5173

# Start development server (bind to all interfaces for Docker)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
