# Use official Node.js image
FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the frontend
RUN npm run build

# Expose the port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
