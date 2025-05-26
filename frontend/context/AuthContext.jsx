import React, {
  createContext,
  useEffect,
  useState,
  useCallback,
  memo,
} from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
axios.defaults.baseURL = backendUrl;

export const AuthContext = createContext();

const AuthProviderComponent = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [authUser, setAuthUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socket, setSocket] = useState(null);

  const connectSocket = useCallback(
    (userData) => {
      if (!userData || socket?.connected) return;
      const newSocket = io(backendUrl, {
        query: {
          userId: userData._id,
        },
      });
      newSocket.connect();
      setSocket(newSocket);

      newSocket.on("getOnlineUsers", (userIds) => {
        setOnlineUsers(userIds);
      });
    },
    [socket]
  );

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/auth/check");
      if (data.success) {
        setAuthUser(data.user);
        connectSocket(data.user);
      }
    } catch (error) {
      toast.error(error.message);
    }
  }, [connectSocket]);

  const login = useCallback(
    async (state, credentials) => {
      try {
        const { data } = await axios.post(`/api/auth/${state}`, credentials);
        if (data.success) {
          setAuthUser(data.userData);
          connectSocket(data.userData);
          axios.defaults.headers.common["token"] = data.token;
          setToken(data.token);
          localStorage.setItem("token", data.token);
          toast.success(data.message);
        } else {
          toast.error(data.message);
        }
      } catch (error) {
        toast.error(error.message);
      }
    },
    [connectSocket]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setAuthUser(null);
    setOnlineUsers([]);
    axios.defaults.headers.common["token"] = null;
    toast.success("Logged out successfully");
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  }, [socket]);

  const updateProfile = useCallback(async (body) => {
    try {
      const { data } = await axios.put("/api/auth/update-profile", body);
      if (data.success) {
        setAuthUser(data.user);
        toast.success("Profile updated successfully");
      }
    } catch (error) {
      toast.error(error.message);
    }
  }, []);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["token"] = token;
    }
    checkAuth();
  }, [token, checkAuth]);

  // Cleanup socket on unmount to avoid dangling connections
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  const value = {
    axios,
    authUser,
    onlineUsers,
    socket,
    login,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const AuthProvider = memo(AuthProviderComponent);
if (import.meta.hot) {
  import.meta.hot.invalidate();
}
