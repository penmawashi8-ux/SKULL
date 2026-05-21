import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HomeScreen } from './screens/HomeScreen'
import { ModeSelectScreen } from './screens/ModeSelectScreen'
import { CpuSetupScreen } from './screens/CpuSetupScreen'
import { CreateRoomScreen } from './screens/CreateRoomScreen'
import { JoinRoomScreen } from './screens/JoinRoomScreen'
import { RoomListScreen } from './screens/RoomListScreen'
import { LobbyScreen } from './screens/LobbyScreen'
import { GameScreen } from './screens/GameScreen'
import { ReconnectBanner } from './components/ReconnectBanner'
import { UpdatePrompt } from './components/UpdatePrompt'

export default function App() {
  return (
    <BrowserRouter>
      <ReconnectBanner />
      <UpdatePrompt />
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/menu" element={<ModeSelectScreen />} />
        <Route path="/cpu" element={<CpuSetupScreen />} />
        <Route path="/online/create" element={<CreateRoomScreen />} />
        <Route path="/online/join" element={<JoinRoomScreen />} />
        <Route path="/online/rooms" element={<RoomListScreen />} />
        <Route path="/room/:roomCode" element={<LobbyScreen />} />
        <Route path="/game/:roomCode" element={<GameScreen />} />
      </Routes>
    </BrowserRouter>
  )
}
